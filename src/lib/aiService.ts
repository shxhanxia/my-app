import { GoogleGenAI } from "@google/genai";
import { ClinicalData, ModelConfig } from "../types";

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

export async function processBatchOfPdfs(
  batch: { name: string; content?: string, file?: File }[],
  config: ModelConfig
): Promise<ClinicalData[]> {
  const prompt = `
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
- pdfName: string (Use the filename I provide)
- gender: "Male" | "Female" | null
- age: number | null
- height: string | null
- weight: string | null
- heartRate: string | null (bpm, number only)
- systolicBP: string | null (mmHg, number only)
- diastolicBP: string | null (mmHg, number only)
- comorbidities: string | null (e.g., "Advanced multiple sclerosis")
- mutantGene: string | null (Specific mutant gene names)
- tumorLocation: string | null (e.g., "Right atrium")
- maxDiameterMm: number | null
- symptoms: string | null (e.g., "Palpitations, fever" or "Asymptomatic")
- pathologyType: string | null (e.g., "Ectopic liver", "Myxoma")
- followUpMonths: number | string | null
- isRecurrent: "Yes" | "No" | null
- country: string | null (First author's country)
- tumorCount: number | null (Usually 1)
- author: string | null (First author name)
`;

  if (!config.baseUrl || config.baseUrl.includes('googleapis.com')) {
    return callGemini(prompt, batch, config);
  } else {
    return callOpenAICompatible(prompt, batch, config);
  }
}

async function callGemini(prompt: string, batch: { name: string; content?: string, file?: File }[], config: ModelConfig): Promise<ClinicalData[]> {
  const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const ai = new GoogleGenAI({ apiKey });
  
  const contentsParts: any[] = [{ text: prompt }];

  for (const item of batch) {
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

  const response = await ai.models.generateContent({
    model: config.model || "gemini-3.1-pro-preview",
    contents: contentsParts,
    config: {
      responseMimeType: "application/json",
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("AI returned empty response");
  
  return parseAIResponse(text);
}

async function callOpenAICompatible(prompt: string, batch: { name: string; content?: string, file?: File }[], config: ModelConfig): Promise<ClinicalData[]> {
  const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) throw new Error("Missing API Key for custom endpoint");
  
  const messagesContent: any[] = [{ type: 'text', text: prompt }];

  for (const item of batch) {
    if (config.isMultimodal && item.file) {
      messagesContent.push({ type: 'text', text: `--- DOCUMENT (Filename: ${item.name}) ---` });
      const b64 = await fileToBase64(item.file);
      messagesContent.push({
        type: 'inlineData',
        inlineData: {
          mimeType: 'application/pdf',
          data: b64
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
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: stringContent }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  return parseAIResponse(content);
}

function parseAIResponse(text: string): ClinicalData[] {
  try {
    let cleanText = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    cleanText = cleanText.replace(/\][\s\]]*$/, ']');
    cleanText = cleanText.replace(/\}[\s\}]*$/, '}');
    const data = JSON.parse(cleanText);
    const finalData = data.results || data.data || data;
    return Array.isArray(finalData) ? finalData : [finalData];
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    throw new Error("AI returned invalid JSON");
  }
}

export async function testConnection(config: ModelConfig): Promise<{ success: boolean; message?: string }> {
  try {
    const testPrompt = "Hello, respond with 'pong' in JSON format: {\"res\": \"pong\"}";
    if (!config.baseUrl || config.baseUrl.includes('googleapis.com')) {
      const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: config.model || "gemini-3.1-pro-preview",
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

