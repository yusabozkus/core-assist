import { AsyncLocalStorage } from 'node:async_hooks';

export type LoggingContextData = {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  storeId?: string;
  route?: string;
  jobId?: string;
  queue?: string;
  ipAddress?: string;
  userAgent?: string;
};

const storage = new AsyncLocalStorage<LoggingContextData>();

export const LoggingContext = {
  get(): LoggingContextData | undefined {
    return storage.getStore();
  },

  run<T>(context: LoggingContextData, callback: () => T): T {
    return storage.run(context, callback);
  },

  update(context: Partial<LoggingContextData>) {
    const current = storage.getStore();
    if (!current) return;
    Object.assign(current, compactContext(context));
  },
};

function compactContext(context: Partial<LoggingContextData>) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  ) as Partial<LoggingContextData>;
}
