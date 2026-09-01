export const DEFAULT_STORE_AI_INSTRUCTION_CONTENTS = [
  'Müşteriye her zaman siz diliyle hitap et.',
  'Ürün adını yalnızca cevabı anlaşılır hâle getiriyorsa kullan; gereksiz yere tekrar etme.',
  'Beden önerilerinde ürünün beden tablosunu ve müşterinin paylaştığı ölçüleri birlikte değerlendir.',
] as const;

export function createDefaultStoreAiInstructions() {
  return DEFAULT_STORE_AI_INSTRUCTION_CONTENTS.map((content, priority) => ({
    content,
    priority,
    active: true,
  }));
}
