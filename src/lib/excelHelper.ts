import * as XLSX from 'xlsx';
import { ClinicalData } from '../types';

export function exportToExcel(data: ClinicalData[]) {
  const worksheetData = data.map(item => ({
    'Filename': item.pdfName,
    'Gender': item.gender || 'Null',
    'Age (years)': item.age ?? 'Null',
    'Height (cm)': item.height || 'Null',
    'Weight (kg)': item.weight || 'Null',
    'Heart rate (bpm)': item.heartRate || 'Null',
    'SBP (mmHg)': item.systolicBP || 'Null',
    'DBP (mmHg)': item.diastolicBP || 'Null',
    'Complication': item.comorbidities || 'Null',
    'Mutant Gene': item.mutantGene || 'Null',
    'Tumor Location': item.tumorLocation || 'Null',
    'The longest diameter of tumor (mm)': item.maxDiameterMm ?? 'Null',
    'Symptom': item.symptoms || 'Null',
    'Pathological Type': item.pathologyType || 'Null',
    'Follow-up period (months)': item.followUpMonths ?? 'Null',
    'Clinical prognosis': item.isRecurrent || 'Null',
    'Country': item.country || 'Null',
    'Number of lumps': item.tumorCount ?? 'Null',
    'Author': item.author || 'Null'
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ExtractedData');

  // Set column widths
  const wscols = [
    { wch: 20 }, // name
    { wch: 10 }, // gender
    { wch: 10 }, // age
    { wch: 15 }, // height
    { wch: 15 }, // weight
    { wch: 20 }, // hr
    { wch: 15 }, // sbp
    { wch: 15 }, // dbp
    { wch: 20 }, // comorbid
    { wch: 15 }, // mutantGene
    { wch: 20 }, // loc
    { wch: 35 }, // dia
    { wch: 20 }, // sym
    { wch: 20 }, // path
    { wch: 25 }, // follow
    { wch: 20 }, // recur
    { wch: 15 }, // country
    { wch: 20 }, // count
    { wch: 15 }, // author
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `Clinical_Data_Extraction_${new Date().toISOString().split('T')[0]}.xlsx`);
}
