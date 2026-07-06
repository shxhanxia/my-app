import * as XLSX from 'xlsx';
import { ClinicalData } from '../types';

export function exportToExcel(data: ClinicalData[]) {
  const worksheetData = data.map(item => ({
    'PDF名': item.pdfName,
    '性别 (Gender)': item.gender || 'Null',
    '年龄 (Age)': item.age ?? 'Null',
    '身高': item.height || 'Null',
    '体重': item.weight || 'Null',
    '入院时心率': item.heartRate || 'Null',
    '入院时收缩压': item.systolicBP || 'Null',
    '入院时舒张压': item.diastolicBP || 'Null',
    '合并症': item.comorbidities || 'Null',
    'PRKAR1A基因突变情况': item.prkar1a || 'Null',
    '肿瘤位置': item.tumorLocation || 'Null',
    '肿瘤最大径 (mm)': item.maxDiameterMm ?? 'Null',
    '症状': item.symptoms || 'Null',
    '病理类型': item.pathologyType || 'Null',
    '随访时间 (月)': item.followUpMonths ?? 'Null',
    '是否复发': item.isRecurrent || 'Null',
    '作者国家': item.country || 'Null',
    '肿瘤数量': item.tumorCount ?? 'Null'
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ExtractedData');

  // Set column widths
  const wscols = [
    { wch: 20 }, // name
    { wch: 10 }, // gender
    { wch: 10 }, // age
    { wch: 10 }, // height
    { wch: 10 }, // weight
    { wch: 15 }, // hr
    { wch: 15 }, // sbp
    { wch: 15 }, // dbp
    { wch: 20 }, // comorbid
    { wch: 20 }, // prkar1a
    { wch: 20 }, // loc
    { wch: 15 }, // dia
    { wch: 20 }, // sym
    { wch: 20 }, // path
    { wch: 15 }, // follow
    { wch: 10 }, // recur
    { wch: 15 }, // country
    { wch: 10 }, // count
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `Clinical_Data_Extraction_${new Date().toISOString().split('T')[0]}.xlsx`);
}
