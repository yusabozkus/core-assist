export type VerifiedInventoryVariant = {
  title: string | null;
  sku: string;
  color: string | null;
  size: string | null;
  price: number;
  currency: string;
  stock: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK';
  lastSyncedAt: string;
};

export type InventoryVerificationResult = {
  productId: string;
  checkedAt: Date;
  snapshotHash: string;
  variants: VerifiedInventoryVariant[];
};

export class InventoryVerificationUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InventoryVerificationUnavailableError';
  }
}
