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

export interface ModelProvider {
  id: string;
  name: string;
  defaultBaseUrl: string;
  models: { id: string; name: string }[];
}

export const PROVIDERS: ModelProvider[] = [
  {
    id: 'google',
    name: 'Google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.5-turbo', name: 'GPT-5.5 Turbo' },
      { id: 'gpt-4o', name: 'GPT-4o' },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat-v4', name: 'DeepSeek V4' },
      { id: 'deepseek-coder-v4', name: 'DeepSeek Coder V4' },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1', // Usually requires proxy for OpenAI compat format
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    ]
  },
  {
    id: 'alibaba',
    name: 'Alibaba (Qwen)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
    ]
  },
  {
    id: 'zhipu',
    name: 'Zhipu (GLM)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4', name: 'GLM-4' },
    ]
  }
];

export interface ProcessingFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: ClinicalData;
  error?: string;
}
