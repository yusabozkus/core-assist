import type { LoggerService, LogLevel } from '@nestjs/common';
import { LoggingContext } from './logging-context';
import { redactInvitationPaths } from './redact-path';

type StructuredLogLevel =
  'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';

type LogRecord = Record<string, unknown>;

const LEVEL_PRIORITY: Record<StructuredLogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

const SENSITIVE_KEY =
  /(authorization|cookie|password|secret|token|credentials|api.?key|signature|private.?key|card.?number|cvv|cvc|raw.?body)/i;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 8_000;
const RESERVED_FIELDS = new Set([
  'timestamp',
  'level',
  'service',
  'environment',
  'message',
  'context',
  'requestId',
  'userId',
  'workspaceId',
  'storeId',
  'route',
  'jobId',
  'queue',
]);

export class StructuredLogger implements LoggerService {
  private enabledLevels: Set<StructuredLogLevel>;
  private readonly format: 'json' | 'pretty';
  private readonly serviceName: string;
  private readonly environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV?.trim() || 'development';
    this.serviceName =
      process.env.LOG_SERVICE_NAME?.trim() || 'core-asistan-api';
    this.format = resolveLogFormat(process.env.LOG_FORMAT, this.environment);
    this.enabledLevels = levelsAtOrAbove(
      normalizeLogLevel(process.env.LOG_LEVEL, this.environment),
    );
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.write('fatal', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]) {
    this.enabledLevels = new Set(
      levels.map((level) => (level === 'log' ? 'log' : level)),
    );
  }

  private write(
    level: StructuredLogLevel,
    rawMessage: unknown,
    rawOptionalParams: unknown[],
  ) {
    if (!this.enabledLevels.has(level)) return;

    const optionalParams = [...rawOptionalParams];
    const context = readNestContext(optionalParams);
    const { message, metadata } = normalizeMessage(rawMessage);
    const extra = normalizeOptionalParams(level, optionalParams);
    const requestContext = LoggingContext.get();
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      service: this.serviceName,
      environment: this.environment,
      ...(sanitizeLogValue(requestContext ?? {}) as LogRecord),
      ...(context ? { context } : {}),
      message,
      ...withoutReservedFields(metadata),
      ...withoutReservedFields(extra),
    };

    const serialized =
      this.format === 'json' ? JSON.stringify(record) : formatPretty(record);
    const stream =
      level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    stream.write(`${serialized}\n`);
  }
}

export function sanitizeLogValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol' || typeof value === 'function') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      ...(value.stack ? { stack: redactText(value.stack) } : {}),
    };
  }
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      result.push(`[${value.length - MAX_ARRAY_ITEMS} MORE_ITEMS]`);
    }
    return result;
  }

  const result: LogRecord = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : sanitizeLogValue(nestedValue, depth + 1, seen);
  }
  return result;
}

function normalizeMessage(rawMessage: unknown): {
  message: string;
  metadata: LogRecord;
} {
  const sanitized = sanitizeLogValue(rawMessage);
  if (isRecord(sanitized)) {
    const candidate = sanitized.message;
    const metadata = { ...sanitized };
    delete metadata.message;
    return {
      message:
        typeof candidate === 'string' ? candidate : 'Structured log event',
      metadata,
    };
  }
  return {
    message: displayValue(sanitized),
    metadata: {},
  };
}

function normalizeOptionalParams(
  level: StructuredLogLevel,
  optionalParams: unknown[],
): LogRecord {
  if (optionalParams.length === 0) return {};
  const sanitized = optionalParams.map((value) => sanitizeLogValue(value));
  if ((level === 'error' || level === 'fatal') && sanitized.length === 1) {
    const [trace] = sanitized;
    return typeof trace === 'string' ? { trace } : { details: trace };
  }
  return { details: sanitized };
}

function readNestContext(optionalParams: unknown[]) {
  if (optionalParams.length === 0) return undefined;
  const candidate = optionalParams.at(-1);
  if (typeof candidate !== 'string') return undefined;
  optionalParams.pop();
  return redactText(candidate);
}

function withoutReservedFields(record: LogRecord): LogRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !RESERVED_FIELDS.has(key)),
  );
}

function redactText(value: string) {
  const redacted = redactInvitationPaths(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:password|secret|token|authorization|cookie|api[_-]?key|signature)=)[^&\s]+/gi,
      '$1[REDACTED]',
    );
  return redacted.length > MAX_STRING_LENGTH
    ? `${redacted.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`
    : redacted;
}

function formatPretty(record: LogRecord) {
  const { timestamp, level, context, message } = record;
  const metadata = Object.fromEntries(
    Object.entries(record).filter(
      ([key]) =>
        ![
          'timestamp',
          'level',
          'context',
          'message',
          'service',
          'environment',
        ].includes(key),
    ),
  );
  const prefix = `${String(timestamp)} ${String(level).toUpperCase().padEnd(7)}`;
  const scope = typeof context === 'string' && context ? ` [${context}]` : '';
  const suffix = Object.keys(metadata).length
    ? ` ${JSON.stringify(metadata)}`
    : '';
  return `${prefix}${scope} ${String(message)}${suffix}`;
}

function displayValue(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function normalizeLogLevel(
  value: string | undefined,
  environment: string,
): StructuredLogLevel {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'info') return 'log';
  if (
    normalized === 'fatal' ||
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'log' ||
    normalized === 'debug' ||
    normalized === 'verbose'
  ) {
    return normalized;
  }
  return environment === 'production' ? 'log' : 'debug';
}

function levelsAtOrAbove(level: StructuredLogLevel) {
  const threshold = LEVEL_PRIORITY[level];
  return new Set(
    (Object.keys(LEVEL_PRIORITY) as StructuredLogLevel[]).filter(
      (candidate) => LEVEL_PRIORITY[candidate] <= threshold,
    ),
  );
}

function resolveLogFormat(value: string | undefined, environment: string) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'json' || normalized === 'pretty') return normalized;
  return environment === 'production' ? 'json' : 'pretty';
}

function isRecord(value: unknown): value is LogRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
