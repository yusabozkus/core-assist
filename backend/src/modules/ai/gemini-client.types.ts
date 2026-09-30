export type GeminiSizeGuideExtraction = {
  title: string;
  audience?: string;
  measurementBasis?: 'BODY' | 'GARMENT' | 'MIXED' | 'UNKNOWN';
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
