import { GoogleGenAI } from "@google/genai";
import { ClinicalData, ModelConfig } from "../types";

export async function processBatchOfPdfs(
  texts: { name: string; content: string }[],
  config: ModelConfig
): Promise<ClinicalData[]> {
  const prompt = `
您是一名专业的医学数据提取专家。请从以下提供的医学文献文本中提取特定的临床数据。

提取规则：
1. 【不产生幻觉】：如果文献中未提及某个字段的信息，请严格输出 null。不要进行主观臆断。
2. 【病因/病理和肿瘤大小】：仔细阅读整个案例。如果提到多种尺寸(如超声尺寸 vs 病理标本尺寸)，优先取病理标本的最大径。例如 "3.5 x 2.5 cm" 表示最大径为 35 (mm)。"7 cm" 表示 70。
3. 【单位转换】：
   - age: 提取数字（岁）
   - weight: 转换为 kg
   - height: 转换为 cm
   - maxDiameterMm: 统一转换为毫米 (mm) 的纯数字
   - followUpMonths: 统一转换为月 (months) 的纯数字格式，如 6 weeks 转换为 1.5 或 1.2 等数值。
4. 【症状 (symptoms)】：精确提取并在必要时翻译为中文（如：心悸、发热、腹部肿胀、右侧腰痛、全身无力、呼吸困难等）。如果明确是“偶然发现 (incidental finding)” 或者没有症状，输出 "无症状"。
5. 【国家 (country)】：从作者的机构(Affiliations)信息中推断作者国家，并翻译为中文（如：UK -> 英国，Canada -> 加拿大，Spain -> 西班牙）。
6. 【复发与否 (isRecurrent)】：如果有随访且提到复发，输出 "是"；如果明确"no evidence of recurrence"等，输出 "否"。如果没提，输出 null。
7. 【肿瘤位置 (tumorLocation)】：给出具体位置并在括号内保留英文原名，如 "右心房 (Right atrial)", "左心房 (Left atrial)"。
8. 【病理类型 (pathologyType)】：给出具体类型并在括号内保留英文，如 "异位肝 (Ectopic liver)", "粘液瘤 (Myxoma)"。
9. 【格式限制】：必须返回一个合法的 JSON 数组，包含所有文档的结果。绝对不要包含任何 Markdown 标记 (如 \`\`\`json)，直接输出原始的 JSON 数组字符串。

需要提取的 JSON 字段定义：
- pdfName: string (使用我提供的文件名)
- gender: "男" | "女" | null
- age: number | null
- height: string | null
- weight: string | null
- heartRate: string | null (此时的心率，保留数字即可)
- systolicBP: string | null (收缩压，数字)
- diastolicBP: string | null (舒张压，数字)
- comorbidities: string | null (合并症，如 "晚期多发性硬化症 / advanced multiple sclerosis" 等)
- prkar1a: string | null
- tumorLocation: string | null (如 "右心房 (Right atrial)")
- maxDiameterMm: number | null
- symptoms: string | null (如 "心悸、发热..." 或 "无症状")
- pathologyType: string | null
- followUpMonths: number | string | null
- isRecurrent: "是" | "否" | null
- country: string | null (作者国家中文名)
- tumorCount: number | null (通常为 1)

待处理文档摘要：
${texts.map((t, i) => `--- 文档 ${i + 1} (文件名: ${t.name}) ---\n${t.content}\n`).join('\n')}
`;

  if (!config.baseUrl || (config.baseUrl.includes('googleapis.com') && !config.baseUrl.includes('openai'))) {
    return callGemini(prompt, config);
  } else {
    return callOpenAICompatible(prompt, config);
  }
}

async function callGemini(prompt: string, config: ModelConfig): Promise<ClinicalData[]> {
  // Use user-provided key if available, else fall back to env key
  const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) throw new Error("Missing Gemini API Key");

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: config.model || "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("AI returned empty response");
  
  try {
    let cleanText = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    // Fix extra trailing brackets or braces that some LLMs generate
    cleanText = cleanText.replace(/\][\s\]]*$/, ']');
    cleanText = cleanText.replace(/\}[\s\}]*$/, '}');
    const data = JSON.parse(cleanText);
    return Array.isArray(data) ? data : [data];
  } catch (e) {
    console.error("Failed to parse AI response:", text);
    throw new Error("AI returned invalid JSON");
  }
}

async function callOpenAICompatible(prompt: string, config: ModelConfig): Promise<ClinicalData[]> {
  const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
  if (!apiKey) throw new Error("Missing API Key for custom endpoint");
  
  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  try {
    let cleanText = content.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    cleanText = cleanText.replace(/\][\s\]]*$/, ']');
    cleanText = cleanText.replace(/\}[\s\}]*$/, '}');
    const data = JSON.parse(cleanText);
    // Some models might wrap it in a root key like "data" or "results"
    const finalData = data.results || data.data || data;
    return Array.isArray(finalData) ? finalData : [finalData];
  } catch (e) {
    throw new Error("Custom AI endpoint returned invalid JSON");
  }
}

export async function testConnection(config: ModelConfig): Promise<{ success: boolean; message?: string }> {
  try {
    const testPrompt = "Hello, respond with 'pong' in JSON format: {\"res\": \"pong\"}";
    if (!config.baseUrl || (config.baseUrl.includes('googleapis.com') && !config.baseUrl.includes('openai'))) {
      const apiKey = config.apiKey || (process.env.GEMINI_API_KEY as string);
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: config.model || "gemini-3-flash-preview",
        contents: testPrompt
      });
    } else {
      await callOpenAICompatible(testPrompt, config);
    }
    return { success: true };
  } catch (e: any) {
    console.error("Connection test failed:", e);
    return { success: false, message: e.message || String(e) };
  }
}
