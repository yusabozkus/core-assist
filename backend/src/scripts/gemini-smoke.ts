import 'dotenv/config';
import { GeminiClientService } from '../modules/ai/gemini-client.service';

async function run() {
  const models = [
    process.env.GEMINI_FAST_MODEL?.trim() || 'gemini-3.5-flash-lite',
    process.env.GEMINI_SMART_MODEL?.trim() || 'gemini-3.5-flash',
  ];
  const client = new GeminiClientService();
  const results: Array<{
    model: string;
    decision: unknown;
    hasAnswer: boolean;
  }> = [];

  for (const [index, model] of models.entries()) {
    const raw = await client.generate({
      model,
      thinkingLevel: index === 0 ? 'minimal' : 'low',
      prompt: [
        'Aşağıdaki doğrulanmış ürün bilgisine dayanarak kısa bir Türkçe taslak oluştur.',
        'Soru: Siyah M beden stokta var mı?',
        'Doğrulanmış bilgi: Siyah M varyantı aktif ve stok miktarı 4.',
        'decision DRAFT, usedFacts STOCK ve missingInformation boş olmalı.',
      ].join('\n'),
    });
    const response = JSON.parse(raw) as Record<string, unknown>;
    results.push({
      model,
      decision: response.decision,
      hasAnswer:
        typeof response.answer === 'string' && response.answer.length >= 2,
    });
  }

  process.stdout.write(`${JSON.stringify({ ok: true, results })}\n`);
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ ok: false, message })}\n`);
  process.exitCode = 1;
});
