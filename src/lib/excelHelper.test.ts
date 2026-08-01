import { describe, it, expect } from 'vitest';
import { buildWorkbook } from './excelHelper';
import type { ClinicalData } from '../types';

function sample(): ClinicalData {
    return {
        pdfName: 'a.pdf',
        gender: 'Male',
        age: 35,
        height: '175',
        weight: '70',
        heartRate: '72',
        systolicBP: '120',
        diastolicBP: '80',
        comorbidities: null,
        mutantGene: 'PRKAR1A',
        tumorLocation: 'Right atrium',
        maxDiameterMm: 35,
        symptoms: 'Palpitations',
        pathologyType: 'Myxoma',
        followUpMonths: 12,
        isRecurrent: 'No',
        country: 'United Kingdom',
        tumorCount: 1,
        author: 'Smith',
    };
}

describe('buildWorkbook', () => {
    it('writes headers and data rows', async () => {
        const wb = await buildWorkbook([sample()]);
        const sheet = wb.getWorksheet('ExtractedData')!;
        expect(sheet.getCell('A1').value).toBe('Filename');
        expect(sheet.getCell('B1').value).toBe('Gender');
        expect(sheet.getCell('A2').value).toBe('a.pdf');
        expect(sheet.getCell('B2').value).toBe('Male');
        expect(sheet.getCell('C2').value).toBe(35);
        expect(sheet.getCell('L2').value).toBe(35);
    });

    it('writes the Null placeholder for missing values', async () => {
        const data = sample();
        data.comorbidities = null;
        const wb = await buildWorkbook([data]);
        const sheet = wb.getWorksheet('ExtractedData')!;
        expect(sheet.getCell('I2').value).toBe('Null');
    });

    it('sets column widths for wide columns', async () => {
        const wb = await buildWorkbook([sample()]);
        const sheet = wb.getWorksheet('ExtractedData')!;
        // Column 12 = 'The longest diameter of tumor (mm)'
        expect(sheet.getColumn(12).width).toBe(35);
        // Column 1 = 'Filename'
        expect(sheet.getColumn(1).width).toBe(20);
    });

    it('round-trips to a buffer', async () => {
        const wb = await buildWorkbook([sample()]);
        const buffer = await wb.xlsx.writeBuffer();
        expect(buffer.byteLength).toBeGreaterThan(0);
    });
});
