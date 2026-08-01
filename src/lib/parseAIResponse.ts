import type { ClinicalData } from '../types';

/**
 * Parse an AI model's response into a ClinicalData[].
 *
 * Models sometimes wrap the JSON in markdown fences, prepend prose, or return a
 * single object / an object with a `results` / `data` key. Instead of relying on
 * brittle trailing-character cleanups, we locate the outermost JSON array (or
 * object) by slicing to the first `[`/`{` and last `]`/`}` and then parse it.
 */
export function parseAIResponse(text: string): ClinicalData[] {
    let cleanText = text.trim();
    cleanText = cleanText
        .replace(/^```[a-z]*\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    if (firstBracket !== -1 && lastBracket > firstBracket) {
        cleanText = cleanText.slice(firstBracket, lastBracket + 1);
    } else if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleanText = cleanText.slice(firstBrace, lastBrace + 1);
    }

    const data = JSON.parse(cleanText);
    const finalData = (data as any).results || (data as any).data || data;
    return Array.isArray(finalData) ? finalData : [finalData];
}
