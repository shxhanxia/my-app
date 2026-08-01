import type { ClinicalData } from '../types';

/**
 * Single source of truth for the 19 extracted fields.
 * Drives the AI extraction prompt, the results table headers/cells, and the
 * Excel export (column names + widths). Order matters: keep it in the order
 * the fields should appear in the prompt, the table, and the spreadsheet.
 */
export interface ClinicalField {
    key: keyof ClinicalData;
    /** Column header shown in the results table and the Excel export. */
    label: string;
    /** Excel column width in characters. */
    width: number;
    /** Type definition shown in the extraction prompt. */
    promptType: string;
    /** Extra guidance appended to the prompt line (units / examples). */
    promptHint?: string;
    /** Tailwind min-width class for the results table cell. */
    cellClass: string;
}

export const CLINICAL_FIELDS: ClinicalField[] = [
    {
        key: 'pdfName',
        label: 'Filename',
        width: 20,
        promptType: 'string',
        promptHint: 'Use the filename I provide',
        cellClass: '',
    },
    {
        key: 'gender',
        label: 'Gender',
        width: 10,
        promptType: '"Male" | "Female" | null',
        cellClass: 'min-w-[80px]',
    },
    {
        key: 'age',
        label: 'Age (years)',
        width: 10,
        promptType: 'number | null',
        promptHint: 'years',
        cellClass: 'min-w-[80px]',
    },
    {
        key: 'height',
        label: 'Height (cm)',
        width: 15,
        promptType: 'string | null',
        promptHint: 'convert to cm',
        cellClass: 'min-w-[80px]',
    },
    {
        key: 'weight',
        label: 'Weight (kg)',
        width: 15,
        promptType: 'string | null',
        promptHint: 'convert to kg',
        cellClass: 'min-w-[80px]',
    },
    {
        key: 'heartRate',
        label: 'Heart rate (bpm)',
        width: 20,
        promptType: 'string | null',
        promptHint: 'bpm, number only',
        cellClass: 'min-w-[100px]',
    },
    {
        key: 'systolicBP',
        label: 'SBP (mmHg)',
        width: 15,
        promptType: 'string | null',
        promptHint: 'mmHg, number only',
        cellClass: 'min-w-[120px]',
    },
    {
        key: 'diastolicBP',
        label: 'DBP (mmHg)',
        width: 15,
        promptType: 'string | null',
        promptHint: 'mmHg, number only',
        cellClass: 'min-w-[120px]',
    },
    {
        key: 'comorbidities',
        label: 'Complication',
        width: 20,
        promptType: 'string | null',
        promptHint: 'e.g., "Advanced multiple sclerosis"',
        cellClass: 'min-w-[200px]',
    },
    {
        key: 'mutantGene',
        label: 'Mutant Gene',
        width: 15,
        promptType: 'string | null',
        promptHint: 'Specific mutant gene names',
        cellClass: 'min-w-[150px]',
    },
    {
        key: 'tumorLocation',
        label: 'Tumor Location',
        width: 20,
        promptType: 'string | null',
        promptHint: 'e.g., "Right atrium"',
        cellClass: 'min-w-[150px]',
    },
    {
        key: 'maxDiameterMm',
        label: 'The longest diameter of tumor (mm)',
        width: 35,
        promptType: 'number | null',
        cellClass: 'min-w-[100px]',
    },
    {
        key: 'symptoms',
        label: 'Symptom',
        width: 20,
        promptType: 'string | null',
        promptHint: 'e.g., "Palpitations, fever" or "Asymptomatic"',
        cellClass: 'min-w-[200px]',
    },
    {
        key: 'pathologyType',
        label: 'Pathological Type',
        width: 20,
        promptType: 'string | null',
        promptHint: 'e.g., "Ectopic liver", "Myxoma"',
        cellClass: 'min-w-[150px]',
    },
    {
        key: 'followUpMonths',
        label: 'Follow-up period (months)',
        width: 25,
        promptType: 'number | string | null',
        cellClass: 'min-w-[120px]',
    },
    {
        key: 'isRecurrent',
        label: 'Clinical prognosis',
        width: 20,
        promptType: '"Yes" | "No" | null',
        cellClass: 'min-w-[100px]',
    },
    {
        key: 'country',
        label: 'Country',
        width: 15,
        promptType: 'string | null',
        promptHint: "First author's country",
        cellClass: 'min-w-[100px]',
    },
    {
        key: 'tumorCount',
        label: 'Number of lumps',
        width: 20,
        promptType: 'number | null',
        promptHint: 'Usually 1',
        cellClass: 'min-w-[80px]',
    },
    {
        key: 'author',
        label: 'Author',
        width: 15,
        promptType: 'string | null',
        promptHint: 'First author name',
        cellClass: 'min-w-[150px]',
    },
];

/** Fields rendered as editable cells (excludes the sticky filename column). */
export const EDITABLE_FIELDS = CLINICAL_FIELDS.filter(
    (f) => f.key !== 'pdfName',
);
