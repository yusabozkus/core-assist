import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { GeminiGenerationRequest } from './ai-draft.types';
import type {
  GeminiSizeGuideExtraction,
  GeminiSizeGuideRequest,
} from './gemini-client.types';

const DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'answer',
    'interpretation',
    'detectedFacts',
    'answerability',
    'decision',
    'confidence',
    'usedEvidenceIds',
    'missingInformation',
  ],
  properties: {
    answer: { type: 'string', minLength: 2, maxLength: 2000 },
    interpretation: { type: 'string', minLength: 2, maxLength: 300 },
    detectedFacts: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: {
        type: 'string',
        enum: [
          'STOCK',
          'PRICE',
          'MATERIAL',
          'DURABILITY',
          'SHIPPING',
          'RETURN',
          'EXCHANGE',
          'WARRANTY',
          'SIZE',
          'COLOR',
          'FIT',
          'CARE',
          'PRODUCT_CODE',
          'PRODUCT_INFO',
        ],
      },
    },
    answerability: {
      type: 'string',
      enum: ['FULL', 'PARTIAL', 'INSUFFICIENT'],
    },
    decision: { type: 'string', enum: ['DRAFT', 'NEEDS_REVIEW'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    usedEvidenceIds: {
      type: 'array',
      items: { type: 'string' },
    },
    missingInformation: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

const SIZE_GUIDE_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'unit',
    'headers',
    'rows',
    'notes',
    'rawText',
    'confidence',
  ],
  properties: {
    title: { type: 'string' },
    unit: { type: 'string', enum: ['CM', 'INCH', 'MIXED', 'UNKNOWN'] },
    headers: { type: 'array', items: { type: 'string' } },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'measurements'],
        properties: {
          label: { type: 'string' },
          measurements: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'value'],
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
              },
            },
          },
        },
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
    rawText: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;

@Injectable()
export class GeminiClientService {
  private readonly client: GoogleGenAI | null;
  private readonly timeoutMs: number;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
    this.timeoutMs = parseTimeout(process.env.GEMINI_REQUEST_TIMEOUT_MS);
  }

  isEnabled() {
    return this.client !== null;
  }

  async generate(request: GeminiGenerationRequest): Promise<string> {
    if (!this.client) {
      throw new Error('Gemini API anahtarı yapılandırılmamış.');
    }

    const interaction = await this.client.interactions.create(
      {
        model: request.model,
        input: request.prompt,
        generation_config: {
          max_output_tokens: 700,
          thinking_level: request.thinkingLevel,
        },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: DRAFT_RESPONSE_SCHEMA,
        },
        store: false,
      },
      { timeout_ms: this.timeoutMs },
    );

    if (!interaction.output_text) {
      throw new Error('Gemini boş bir yanıt döndürdü.');
    }

    return interaction.output_text;
  }

  async extractSizeGuide(
    request: GeminiSizeGuideRequest,
  ): Promise<GeminiSizeGuideExtraction> {
    if (!this.client) {
      throw new Error('Gemini API anahtarı yapılandırılmamış.');
    }

    const interaction = await this.client.interactions.create(
      {
        model: request.model,
        input: [
          { type: 'text', text: request.prompt },
          {
            type: 'image',
            data: request.imageBase64,
            mime_type: request.mimeType,
          },
        ],
        generation_config: {
          max_output_tokens: 2_000,
          thinking_level: 'minimal',
        },
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: SIZE_GUIDE_RESPONSE_SCHEMA,
        },
        store: false,
      },
      { timeout_ms: Math.max(this.timeoutMs, 30_000) },
    );

    if (!interaction.output_text) {
      throw new Error('Gemini beden tablosu için boş bir yanıt döndürdü.');
    }

    return parseSizeGuideExtraction(interaction.output_text);
  }
}

function parseSizeGuideExtraction(raw: string): GeminiSizeGuideExtraction {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) {
    throw new Error('Beden tablosu analizi geçerli bir nesne değil.');
  }

  const rows = Array.isArray(value.rows) ? value.rows : [];
  if (rows.length === 0) {
    throw new Error('Görselde okunabilir beden tablosu satırı bulunamadı.');
  }

  return value as GeminiSizeGuideExtraction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 60_000
    ? parsed
    : 10_000;
}
