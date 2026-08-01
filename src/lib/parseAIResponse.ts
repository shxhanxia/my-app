import type { ClinicalData } from '../types';
import { CLINICAL_FIELDS } from './clinicalFields';

/**
 * Fields the prompt promises as pure numbers. Numeric-looking strings are
 * coerced to numbers so the Excel export contains real numeric cells.
 */
const NUMERIC_FIELDS = new Set<keyof ClinicalData>([
    'age',
    'maxDiameterMm',
    'followUpMonths',
    'tumorCount',
]);

/**
 * Normalize one raw parsed item into a well-formed ClinicalData.
 * Missing fields become null, numeric fields are coerced, and non-object
 * entries (model noise) are dropped. Returns null for unusable items.
 */
export function normalizeClinicalData(raw: unknown): ClinicalData | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return null;
    }
    const item = raw as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const { key } of CLINICAL_FIELDS) {
        let value = item[key] ?? null;
        if (NUMERIC_FIELDS.has(key) && value !== null) {
            if (typeof value === 'number') {
                // Already a number — keep as-is.
            } else {
                const str = String(value).trim();
                if (str === '') {
                    value = null;
                } else {
                    const num = Number(str);
                    if (Number.isFinite(num)) value = num;
                    // Non-numeric strings are kept for manual review.
                }
            }
        }
        result[key] = value;
    }
    return result as unknown as ClinicalData;
}

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
    const arr = Array.isArray(finalData) ? finalData : [finalData];
    return arr
        .map(normalizeClinicalData)
        .filter((x): x is ClinicalData => x !== null);
}
