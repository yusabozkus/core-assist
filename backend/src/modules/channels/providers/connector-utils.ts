export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];
}

export function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

export function firstNumber(
  record: Record<string, unknown>,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === 'number' ? value : Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return fallback;
}

export function basicAuthorization(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function readProviderError(response: Response): Promise<string> {
  const body = await response.text();

  if (!body) {
    return `Provider request failed with status ${response.status}.`;
  }

  return `Provider request failed with status ${response.status}: ${body.slice(0, 300)}`;
}
