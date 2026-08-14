import type {
  CommandOutcome,
  StockChannel,
  StockReason,
} from "@/lib/domain/stock";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BatchRow = {
  id: string;
  product_id: string;
  batch_code: string;
  expiry_date: string;
  source_type: "PRODUCTION" | "RETURN";
  created_at: string;
};

export type BalanceRow = {
  product_id: string;
  batch_id: string;
  on_hand_qty: number;
  updated_at: string;
};

export type OpeningBalanceRow = {
  id: string;
  product_id: string;
  batch_id: string;
  qty: number;
  verification_status: "UNVERIFIED" | "VERIFIED";
  created_at: string;
  verified_at: string | null;
};

export type BatchInventory = BatchRow & {
  onHandQty: number;
  openingBalance: OpeningBalanceRow | null;
};

export type ProductMarketplaceListing = {
  id: string;
  channel: Extract<StockChannel, "SHOPEE" | "TIKTOK">;
  listing_sku: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductInventory = ProductRow & {
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  batches: BatchInventory[];
  marketplaceListings: ProductMarketplaceListing[];
};

export type LedgerRow = {
  id: string;
  sequence_no: number;
  movement_group_id: string;
  product_id: string;
  batch_id: string;
  qty_delta: number;
  reason: StockReason;
  channel: StockChannel;
  source_type: string;
  source_id: string;
  reference: string | null;
  reverses_movement_id: string | null;
  actor_id: string;
  movement_key: string;
  occurred_at: string;
  created_at: string;
};

export type MovementGroupRow = {
  id: string;
  business_command_id: string;
  group_type: string;
  source_type: string | null;
  source_id: string | null;
  reversal_group_id: string | null;
  created_at: string;
};

export type BusinessCommandRow = {
  id: string;
  command_type: string;
  idempotency_key: string;
  status: "PROCESSING" | "APPLIED" | "REJECTED";
  source_type: string | null;
  source_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

export type LedgerEntry = LedgerRow & {
  product: ProductRow | null;
  batch: BatchRow | null;
  command: BusinessCommandRow | null;
  isReversed: boolean;
  currentBatchBalance: number;
};

export type FefoAllocation = {
  batch_id: string;
  batch_code: string;
  expiry_date: string;
  allocated_qty: number;
  balance_before: number;
  balance_after: number;
};

export type FefoPreview = {
  requested_qty: number;
  on_hand_qty?: number;
  reserved_qty?: number;
  available_qty: number;
  sufficient: boolean;
  allocations: FefoAllocation[];
};

export type ReceiptMovement = {
  movement_id: string;
  sequence_no: number;
  movement_key: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  batch_id: string;
  batch_code: string;
  expiry_date: string;
  qty_delta: number;
  reason: StockReason;
  channel: StockChannel;
  balance_before: number;
  balance_after: number;
  reference: string | null;
  reverses_movement_id: string | null;
  occurred_at: string;
};

export type CommandReceipt = {
  outcome: CommandOutcome;
  command_id: string;
  movement_group_id: string | null;
  idempotency_key: string;
  command_type: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  completed_at: string | null;
  movements: ReceiptMovement[];
  error: null | {
    code: string;
    message: string;
  };
};

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function commandLabel(commandType: string): string {
  const labels: Record<string, string> = {
    RECORD_OPENING_BALANCE: "Pencatatan saldo awal",
    RECEIVE_GOODS: "Penerimaan barang",
    POST_MANUAL_OUTBOUND: "Barang keluar manual",
    CORRECT_MOVEMENT: "Koreksi riwayat stok",
    REBUILD_STOCK_BALANCES: "Penghitungan ulang saldo stok",
    INGEST_MARKETPLACE_EVENT: "Perubahan status order",
    SHIP_ORDER: "Pengiriman order",
    CANCEL_ORDER_ITEMS: "Pembatalan item order",
    CREATE_RETURN: "Pencatatan retur",
    INSPECT_RETURN_ITEM: "Pemeriksaan barang retur",
    FINALIZE_OPNAME: "Penyelesaian stok opname",
  };

  return labels[commandType] ?? "Transaksi stok";
}

export function reasonLabel(reason: StockReason): string {
  const labels: Record<StockReason, string> = {
    OPENING_BALANCE: "Saldo awal",
    PRODUCTION_RECEIPT: "Barang masuk",
    ONLINE_SALE: "Penjualan online",
    OFFLINE_SALE: "Penjualan offline",
    BONUS: "Bonus",
    PROMO: "Promo",
    SAMPLE: "Sampel",
    DAMAGED: "Rusak",
    EXPIRED: "Kedaluwarsa",
    SELLABLE_RETURN: "Retur layak jual",
    CANCELLATION_REVERSAL: "Pembalikan pembatalan",
    ENTRY_CORRECTION: "Koreksi input",
    OPNAME_ADJUSTMENT: "Penyesuaian opname",
  };

  return labels[reason];
}

export function channelLabel(channel: StockChannel): string {
  const labels: Record<StockChannel, string> = {
    SHOPEE: "Shopee",
    TIKTOK: "TikTok",
    OFFLINE: "Penjualan langsung",
    INTERNAL: "Gudang",
  };

  return labels[channel];
}

export function batchSourceLabel(
  sourceType: BatchRow["source_type"],
): string {
  return sourceType === "PRODUCTION" ? "Produksi maklon" : "Retur barang";
}
