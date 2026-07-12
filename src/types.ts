/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClinicalData {
  pdfName: string;
  gender: string | null;
  age: number | string | null;
  height: string | null;
  weight: string | null;
  heartRate: string | null;
  systolicBP: string | null;
  diastolicBP: string | null;
  comorbidities: string | null;
  prkar1a: string | null;
  tumorLocation: string | null;
  maxDiameterMm: number | string | null;
  symptoms: string | null;
  pathologyType: string | null;
  followUpMonths: number | string | null;
  isRecurrent: string | null;
  country: string | null;
  tumorCount: number | string | null;
}

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProcessingFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ClinicalData;
  error?: string;
}
