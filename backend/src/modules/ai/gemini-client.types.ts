export type GeminiSizeGuideExtraction = {
  title: string;
  unit: 'CM' | 'INCH' | 'MIXED' | 'UNKNOWN';
  headers: string[];
  rows: Array<{
    label: string;
    measurements: Array<{ name: string; value: string }>;
  }>;
  notes: string[];
  rawText: string;
  confidence: number;
};

export type GeminiSizeGuideRequest = {
  model: string;
  prompt: string;
  imageBase64: string;
  mimeType: string;
};
