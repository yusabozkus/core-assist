import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { GeminiGenerationRequest } from './ai-draft.types';

const DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'answer',
    'decision',
    'confidence',
    'usedFacts',
    'missingInformation',
  ],
  properties: {
    answer: { type: 'string', minLength: 2, maxLength: 2000 },
    decision: { type: 'string', enum: ['DRAFT', 'NEEDS_REVIEW'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    usedFacts: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'STOCK',
          'PRICE',
          'MATERIAL',
          'DURABILITY',
          'SHIPPING',
          'PRODUCT_INFO',
        ],
      },
    },
    missingInformation: {
      type: 'array',
      items: { type: 'string' },
    },
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
}

function parseTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 60_000
    ? parsed
    : 10_000;
}
