import { StockEmailAlertLevel } from '../../generated/prisma/enums';

export function stockEmailAlertLevel(
  stock: number,
): StockEmailAlertLevel | null {
  if (stock === 0) return StockEmailAlertLevel.OUT_OF_STOCK;
  if (stock > 0 && stock <= 5) return StockEmailAlertLevel.LOW_STOCK;
  return null;
}

export function stockEmailAlertUpdate(
  previousLevel: StockEmailAlertLevel | null,
  previousStock: number,
  currentStock: number,
  startedAt: Date,
) {
  if (currentStock > 5) {
    return previousLevel
      ? { stockEmailAlertLevel: null, stockEmailAlertStartedAt: null }
      : {};
  }
  if (currentStock === 0) {
    if (previousLevel === StockEmailAlertLevel.OUT_OF_STOCK) return {};
    return {
      stockEmailAlertLevel: StockEmailAlertLevel.OUT_OF_STOCK,
      stockEmailAlertStartedAt: previousStock > 0 ? startedAt : null,
    };
  }
  if (
    previousLevel === StockEmailAlertLevel.OUT_OF_STOCK ||
    previousLevel === StockEmailAlertLevel.LOW_STOCK
  ) {
    return {};
  }
  return {
    stockEmailAlertLevel: StockEmailAlertLevel.LOW_STOCK,
    stockEmailAlertStartedAt: previousStock > 5 ? startedAt : null,
  };
}
