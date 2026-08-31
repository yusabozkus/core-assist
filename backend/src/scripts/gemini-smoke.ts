import 'dotenv/config';
import { GeminiClientService } from '../modules/ai/gemini-client.service';

async function run() {
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const client = new GeminiClientService();

  const raw = await client.generate({
    model,
    thinkingLevel: 'minimal',
    prompt: [
      'Aşağıdaki doğrulanmış ürün bilgisine dayanarak kısa bir Türkçe taslak oluştur.',
      'Soru: Siyah M beden stokta var mı?',
      'Doğrulanmış bilgi: Siyah M varyantı aktif ve stok miktarı 4.',
      'Kanıt kimliği: variant-stock.',
      'decision DRAFT, usedEvidenceIds ["variant-stock"] ve missingInformation boş olmalı.',
    ].join('\n'),
  });
  const response = JSON.parse(raw) as Record<string, unknown>;

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      model,
      decision: response.decision,
      hasAnswer:
        typeof response.answer === 'string' && response.answer.length >= 2,
    })}\n`,
  );
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ ok: false, message })}\n`);
  process.exitCode = 1;
});
