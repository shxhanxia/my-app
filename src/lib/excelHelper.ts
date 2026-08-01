import type { ClinicalData } from '../types';
import { CLINICAL_FIELDS } from './clinicalFields';

/**
 * Build the export workbook. Extracted from exportToExcel so it can be unit
 * tested without a browser. The heavy exceljs library is lazy-loaded.
 */
export async function buildWorkbook(data: ClinicalData[]) {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('ExtractedData');

    sheet.columns = CLINICAL_FIELDS.map((f) => ({ width: f.width }));

    const header = sheet.addRow(CLINICAL_FIELDS.map((f) => f.label));
    header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF334155' },
        };
        cell.alignment = { vertical: 'middle' };
    });

    for (const item of data) {
        sheet.addRow(CLINICAL_FIELDS.map((f) => item[f.key] ?? 'Null'));
    }

    return workbook;
}

export async function exportToExcel(data: ClinicalData[]) {
    const workbook = await buildWorkbook(data);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clinical_Data_Extraction_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}
