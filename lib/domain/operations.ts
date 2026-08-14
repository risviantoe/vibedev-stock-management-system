import type {
  BatchRow,
  CommandReceipt,
  ProductRow,
} from "@/lib/domain/inventory";
import type {
  MarketplaceChannel,
  MarketplaceOrder,
  OrderItem,
} from "@/lib/domain/marketplace";

export const RETURN_CONDITIONS = [
  "SELLABLE",
  "DAMAGED",
  "LOST",
] as const;

export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];
export type ReturnInspectionStatus = "PENDING" | "INSPECTED";
export type ReturnClaimStatus = "OPEN" | "RESOLVED";

export type ReturnRow = {
  id: string;
  external_return_id: string;
  order_id: string;
  channel: MarketplaceChannel;
  claim_deadline: string | null;
  claim_status: ReturnClaimStatus;
  created_command_id: string;
  created_by: string;
  created_at: string;
  recorded_at: string;
  updated_at: string;
};

export type ReturnItemRow = {
  id: string;
  return_id: string;
  order_item_id: string;
  product_id: string;
  qty: number;
  inspection_status: ReturnInspectionStatus;
  condition: ReturnCondition | null;
  return_batch_id: string | null;
  inspected_command_id: string | null;
  inspected_by: string | null;
  inspected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReturnItem = ReturnItemRow & {
  product: ProductRow | null;
  orderItem: OrderItem | null;
  returnBatch: BatchRow | null;
};

export type ReturnRecord = ReturnRow & {
  order: MarketplaceOrder | null;
  items: ReturnItem[];
  remainingClaimDays: number | null;
};

export type ReturnCandidate = {
  key: string;
  orderId: string;
  externalOrderId: string;
  channel: MarketplaceChannel;
  orderItemId: string;
  externalLineId: string;
  listingSku: string;
  productId: string;
  product: ProductRow | null;
  shippedQty: number;
  returnedQty: number;
  returnableQty: number;
};

export type OpnameSessionStatus = "DRAFT" | "FINALIZED";

export type OpnameSessionRow = {
  id: string;
  idempotency_key: string;
  status: OpnameSessionStatus;
  actor_id: string;
  started_at: string;
  finalized_at: string | null;
  finalized_command_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OpnameCountRow = {
  session_id: string;
  product_id: string;
  batch_id: string;
  system_qty: number;
  physical_qty: number | null;
  variance_qty: number | null;
  saved_at: string | null;
};

export type OpnameCount = OpnameCountRow & {
  product: ProductRow | null;
  batch: BatchRow | null;
};

export type OpnameSession = OpnameSessionRow & {
  counts: OpnameCount[];
};

export const ANOMALY_TYPES = [
  "PROJECTION_DRIFT",
  "NEGATIVE_STOCK",
  "ORDER_LEDGER_MISMATCH",
  "DUPLICATE_PROCESSING",
  "ORPHAN_MOVEMENT",
  "OVER_RETURN",
  "OVERDUE_RETURN",
] as const;

export type AnomalyType = (typeof ANOMALY_TYPES)[number];
export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";
export type AnomalyStatus = "OPEN" | "RESOLVED";

export type AnomalyRow = {
  id: string;
  fingerprint: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  product_id: string | null;
  batch_id: string | null;
  order_id: string | null;
  return_id: string | null;
  movement_id: string | null;
  explanation: string;
  evidence: Record<string, unknown>;
  detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  type: "EXPIRY" | "TIKTOK_CLAIM";
  severity: "WARNING" | "CRITICAL";
  title: string;
  message: string;
  due_at: string;
  product_id: string | null;
  batch_id: string | null;
  return_id: string | null;
  created_at: string;
};

export type OperationsWorkspace = {
  products: ProductRow[];
  orders: MarketplaceOrder[];
  returns: ReturnRecord[];
  returnCandidates: ReturnCandidate[];
  opnameSessions: OpnameSession[];
  activeOpname: OpnameSession | null;
  anomalies: AnomalyRow[];
  notifications: NotificationRow[];
};

export type ReturnReceipt = CommandReceipt & {
  return: {
    id: string;
    external_return_id: string;
    order_id: string;
    external_order_id: string;
    channel: MarketplaceChannel;
    claim_deadline: string | null;
    claim_status: ReturnClaimStatus;
    created_at: string;
    items: Array<{
      id: string;
      order_item_id: string;
      external_line_id: string;
      product_id: string;
      product_sku: string;
      product_name: string;
      qty: number;
      inspection_status: ReturnInspectionStatus;
      condition: ReturnCondition | null;
      return_batch_id: string | null;
      inspected_at: string | null;
    }>;
  };
};

export type ReturnInspectionReceipt = CommandReceipt & {
  return_item: {
    id: string;
    return_id: string;
    product_id: string;
    product_sku: string;
    product_name: string;
    qty: number;
    inspection_status: ReturnInspectionStatus;
    condition: ReturnCondition;
    return_batch_id: string | null;
    batch_code: string | null;
    expiry_date: string | null;
    inspected_at: string;
  };
};

export type OpnameFinalizeReceipt = CommandReceipt & {
  session: {
    id: string;
    status: OpnameSessionStatus;
    started_at: string;
    finalized_at: string | null;
    count_rows: number;
    variance_rows: number;
  };
};

export function returnConditionLabel(condition: ReturnCondition): string {
  const labels: Record<ReturnCondition, string> = {
    SELLABLE: "Layak jual",
    DAMAGED: "Rusak",
    LOST: "Hilang",
  };
  return labels[condition];
}

export function anomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    PROJECTION_DRIFT: "Saldo tidak sesuai dengan riwayat",
    NEGATIVE_STOCK: "Saldo batch di bawah nol",
    ORDER_LEDGER_MISMATCH: "Order tidak sesuai dengan riwayat stok",
    DUPLICATE_PROCESSING: "Event diproses lebih dari sekali",
    ORPHAN_MOVEMENT: "Pergerakan tidak terhubung ke order",
    OVER_RETURN: "Jumlah retur melebihi pengiriman",
    OVERDUE_RETURN: "Batas klaim retur terlewati",
  };
  return labels[type];
}

export function anomalySeverityLabel(severity: AnomalySeverity): string {
  const labels: Record<AnomalySeverity, string> = {
    INFO: "Informasi",
    WARNING: "Perlu ditinjau",
    CRITICAL: "Perlu segera ditangani",
  };

  return labels[severity];
}

export function anomalyStatusLabel(status: AnomalyStatus): string {
  return status === "OPEN" ? "Belum selesai" : "Sudah selesai";
}

export function anomalyOperatorCopy(type: AnomalyType): {
  explanation: string;
  action: string;
} {
  const copy: Record<AnomalyType, { explanation: string; action: string }> = {
    PROJECTION_DRIFT: {
      explanation: "Saldo tersimpan berbeda dari total pergerakan stok.",
      action: "Periksa produk dan pergerakan terakhir sebelum melanjutkan transaksi.",
    },
    NEGATIVE_STOCK: {
      explanation: "Satu atau beberapa batch memiliki saldo kurang dari nol.",
      action: "Tunda pengeluaran stok terkait dan periksa riwayat batch.",
    },
    ORDER_LEDGER_MISMATCH: {
      explanation: "Jumlah atau status order berbeda dari perubahan stok yang tercatat.",
      action: "Buka order untuk membandingkan item, alokasi, dan pengiriman.",
    },
    DUPLICATE_PROCESSING: {
      explanation: "Satu event marketplace terdeteksi diproses lebih dari sekali.",
      action: "Periksa riwayat event; stok seharusnya hanya berubah satu kali.",
    },
    ORPHAN_MOVEMENT: {
      explanation: "Ada perubahan stok marketplace yang tidak terhubung ke order asal.",
      action: "Periksa riwayat stok dan pastikan sumber transaksinya benar.",
    },
    OVER_RETURN: {
      explanation: "Jumlah barang yang diretur melebihi jumlah yang pernah dikirim.",
      action: "Periksa order dan catatan retur sebelum melakukan inspeksi.",
    },
    OVERDUE_RETURN: {
      explanation: "Batas waktu klaim retur telah terlewati.",
      action: "Tinjau retur dan tindak lanjuti klaim pada channel terkait.",
    },
  };

  return copy[type];
}

export function anomalyEvidenceLabel(key: string): string {
  const labels: Record<string, string> = {
    claim_deadline: "Batas klaim",
    external_order_id: "ID order marketplace",
    external_return_id: "ID retur marketplace",
    order_id: "ID order sistem",
    product_id: "ID produk",
    batch_id: "ID batch",
    movement_id: "ID pergerakan",
    ledger_qty: "Jumlah menurut riwayat",
    projection_qty: "Saldo tersimpan",
    reserved_qty: "Jumlah dialokasikan",
    returned_qty: "Jumlah diretur",
    shipped_qty: "Jumlah dikirim",
  };

  return (
    labels[key] ??
    key
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}
