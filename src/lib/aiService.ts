import { ClinicalData, ModelConfig } from "../types";
import { parseAIResponse } from "./parseAIResponse";
import { CLINICAL_FIELDS } from "./clinicalFields";
import { DEFAULT_MODEL } from "../config";

type DocumentItem = { name: string; content?: string; file?: File };

/**
 * Client-side cancellation for APIs that do not accept an AbortSignal
 * directly (the @google/genai SDK). Rejects with an AbortError once the
 * signal fires; the underlying request keeps running but its result is
 * ignored. The SDK documents its own abortSignal as client-only too.
 */
function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
}

function buildExtractionPrompt(): string {
  const fieldLines = CLINICAL_FIELDS.map(f => {
    const hint = f.promptHint ? ` (${f.promptHint})` : '';
    return `- ${f.key}: ${f.promptType}${hint}`;
  }).join('\n');

  return `
You are a professional medical data extraction expert. Please extract specific clinical case data from the provided medical literature texts.

RULES:
1. [No Hallucinations]: If information for a field is not mentioned in the literature, strictly output null. Do not make assumptions.
2. [Multiple Cases per PDF]: A single literature file might report multiple clinical cases (e.g., Case 1, Case 2, Case 3). You MUST identify all cases and output ONE JSON object FOR EACH CASE. If a PDF contains 3 cases, you must return 3 objects with the same pdfName.
3. [Language]: ALL OUTPUT VALUES MUST BE IN ENGLISH. Translate any extracted information to English if it is in another language.
4. [Etiology/Pathology & Tumor Size]: Read the entire case carefully. If multiple sizes are mentioned (e.g., ultrasound size vs pathological specimen size), prefer the maximum diameter of the pathological specimen. For example, "3.5 x 2.5 cm" means max diameter is 35 (mm). "7 cm" means 70.
5. [Unit Conversions]:
   - age: extract number (years)
   - weight: convert to kg
   - height: convert to cm
   - maxDiameterMm: uniformly convert to millimeters (mm) as a pure number.
   - followUpMonths: uniformly convert to months as a pure number, e.g., 6 weeks -> 1.5.
6. [Symptoms]: Extract precisely in English. If explicitly "incidental finding" or no symptoms, output "Asymptomatic".
7. [Mutant Gene]: Extract the specific name of the mutated gene (or genes with abnormal expression), not limited to PRKAR1A.
8. [Country]: Infer the author's country from the Affiliations and output in English (e.g., United Kingdom, Canada, Spain).
9. [Author]: Extract the name of the first author.
10. [Is Recurrent]: If follow-up mentions recurrence, output "Yes"; if explicitly "no evidence of recurrence", output "No". If not mentioned, output null.
11. [Format]: MUST return a valid JSON array containing the results for all documents and cases. DO NOT include any Markdown formatting (like \`\`\`json), output the raw JSON array string directly.

JSON FIELDS DEFINITION:
${fieldLines}
`;
}

/**
 * Process a single PDF against the AI. One independent API call per file, so a
 * failure on any single file does not take down the whole batch.
 *
 * @param signal optional AbortSignal so the user can cancel in-flight calls.
 */
export async function processPdf(
  item: DocumentItem,
  config: ModelConfig,
  signal?: AbortSignal
): Promise<ClinicalData[]> {
  const prompt = buildExtractionPrompt();
  if (!config.baseUrl || config.baseUrl.includes('googleapis.com')) {
    return callGemini(prompt, [item], config, signal);
  } else {
    return callOpenAICompatible(prompt, [item], config, signal);
  }
}

async function callGemini(prompt: string, items: DocumentItem[], config: ModelConfig, signal?: AbortSignal): Promise<ClinicalData[]> {
  const { GoogleGenAI } = await import("@google/genai");
  const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const ai = new GoogleGenAI({ apiKey });

  const contentsParts: any[] = [{ text: prompt }];

  for (const item of items) {
    if (config.isMultimodal && item.file) {
      contentsParts.push({ text: `--- DOCUMENT (Filename: ${item.name}) ---` });
      const b64 = await fileToBase64(item.file);
      contentsParts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: b64
        }
      });
    } else {
      contentsParts.push({ text: `--- DOCUMENT (Filename: ${item.name}) ---\n${item.content}\n` });
    }
  }

  const response = await withAbort(
    ai.models.generateContent({
      model: config.model || DEFAULT_MODEL,
      contents: contentsParts,
      config: {
        responseMimeType: "application/json",
      },
    }),
    signal
  );

  const text = response.text;
  if (!text) throw new Error("AI returned empty response");

  return parseAIResponse(text);
}

async function callOpenAICompatible(prompt: string, items: DocumentItem[], config: ModelConfig, signal?: AbortSignal): Promise<ClinicalData[]> {
  const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) throw new Error("Missing API Key for custom endpoint");

  const messagesContent: any[] = [{ type: 'text', text: prompt }];

  for (const item of items) {
    if (config.isMultimodal && item.file) {
      messagesContent.push({ type: 'text', text: `--- DOCUMENT (Filename: ${item.name}) ---` });
      const b64 = await fileToBase64(item.file);
      const mimeType = item.file.type || 'application/pdf';
      messagesContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${b64}`
        }
      });
    } else {
      messagesContent.push({ type: 'text', text: `--- DOCUMENT (Filename: ${item.name}) ---\n${item.content}\n` });
    }
  }

  const stringContent = config.isMultimodal ? messagesContent : messagesContent.map(m => m.text).join('\n');

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: stringContent }],
      response_format: { type: 'json_object' }
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  return parseAIResponse(content);
}

export async function testConnection(config: ModelConfig): Promise<{ success: boolean; message?: string }> {
  try {
    const testPrompt = "Hello, respond with 'pong' in JSON format: {\"res\": \"pong\"}";
    if (!config.baseUrl || config.baseUrl.includes('googleapis.com')) {
      const { GoogleGenAI } = await import("@google/genai");
      const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: config.model || DEFAULT_MODEL,
        contents: testPrompt
      });
    } else {
      await callOpenAICompatible(testPrompt, [], config);
    }
    return { success: true };
  } catch (e: any) {
    console.error("Connection test failed:", e);
    return { success: false, message: e.message || String(e) };
  }
}
