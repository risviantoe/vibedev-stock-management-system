export const STOCK_CHANNELS = [
  "SHOPEE",
  "TIKTOK",
  "OFFLINE",
  "INTERNAL",
] as const;

export const STOCK_REASONS = [
  "OPENING_BALANCE",
  "PRODUCTION_RECEIPT",
  "ONLINE_SALE",
  "OFFLINE_SALE",
  "BONUS",
  "PROMO",
  "SAMPLE",
  "DAMAGED",
  "EXPIRED",
  "SELLABLE_RETURN",
  "CANCELLATION_REVERSAL",
  "ENTRY_CORRECTION",
  "OPNAME_ADJUSTMENT",
] as const;

export const COMMAND_OUTCOMES = [
  "APPLIED",
  "DUPLICATE",
  "REJECTED",
] as const;

export type StockChannel = (typeof STOCK_CHANNELS)[number];
export type StockReason = (typeof STOCK_REASONS)[number];
export type CommandOutcome = (typeof COMMAND_OUTCOMES)[number];

export type MovementReceiptLine = {
  movementId: string;
  movementKey: string;
  productId: string;
  batchId: string;
  qtyDelta: number;
  reason: StockReason;
  channel: StockChannel;
  balanceAfter: number;
};

export type MovementReceipt = {
  outcome: CommandOutcome;
  commandId: string;
  movementGroupId: string | null;
  idempotencyKey: string;
  commandType: string;
  createdAt: string;
  movements: MovementReceiptLine[];
  error: null | {
    code: string;
    message: string;
  };
};

export function normalizeIdempotencyKey(value: string): string {
  const normalized = value.trim();

  if (normalized.length < 8 || normalized.length > 160) {
    throw new Error("Idempotency key harus memiliki 8-160 karakter.");
  }

  if (!/^[A-Za-z0-9:_./-]+$/.test(normalized)) {
    throw new Error("Idempotency key mengandung karakter yang tidak didukung.");
  }

  return normalized;
}
