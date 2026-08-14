import type { StockChannel, StockReason } from "@/lib/domain/stock";

export type ProofStatus = "PASS" | "FAIL";

export type BalanceProofProduct = {
  id: string;
  sku: string;
  name: string;
  is_active: boolean;
};

export type BalanceProofMovement = {
  id: string;
  sequence_no: number;
  command_id: string;
  batch_id: string;
  batch_code: string;
  expiry_date: string;
  qty_delta: number;
  before_qty: number;
  after_qty: number;
  reason: StockReason;
  channel: StockChannel;
  source_type: string;
  source_id: string;
  reference: string | null;
  occurred_at: string;
};

export type BalanceProofCategory = {
  key:
    | "OPENING"
    | "INBOUND"
    | "MARKETPLACE"
    | "OFFLINE"
    | "PROMOTION"
    | "RETURN"
    | "CORRECTION"
    | "OPNAME";
  label: string;
  description: string;
  total_qty: number;
  movement_count: number;
  movements: BalanceProofMovement[];
};

export type BalanceProofBatch = {
  id: string;
  batch_code: string;
  expiry_date: string;
  source_type: "PRODUCTION" | "RETURN";
  ledger_qty: number;
  projection_qty: number;
  matches_projection: boolean;
};

export type ProductBalanceExplanation = {
  generated_at: string;
  product: BalanceProofProduct;
  projection_qty: number;
  ledger_qty: number;
  reserved_qty: number;
  available_qty: number;
  breakdown_total: number;
  matches_projection: boolean;
  categories: BalanceProofCategory[];
  batches: BalanceProofBatch[];
};

export type IntegrityCheck = {
  id:
    | "projection_equals_ledger"
    | "no_negative_batch"
    | "no_duplicate_applied_event"
    | "no_orphan_movement"
    | "valid_order_status"
    | "no_over_return"
    | "movement_groups_reconciled"
    | "append_only_guard_active";
  label: string;
  status: ProofStatus;
  severity: "CRITICAL" | "WARNING";
  issue_count: number;
  summary: string;
};

export type IntegrityReport = {
  generated_at: string;
  overall_status: ProofStatus;
  passed_count: number;
  failed_count: number;
  movement_count: number;
  projection_count: number;
  open_anomaly_count: number;
  checks: IntegrityCheck[];
};

export type IntegrityChallengeScenario = {
  id: string;
  title: string;
  status: ProofStatus;
  summary: string;
  evidence: Record<string, unknown>;
};

export type IntegrityChallengeResult = {
  run_id: string;
  started_at: string;
  completed_at: string;
  overall_status: ProofStatus;
  isolation: "TEMPORARY_FIXTURE";
  main_dataset_unchanged: boolean;
  dataset_fingerprint: Record<string, number>;
  scenarios: IntegrityChallengeScenario[];
};

export type DemoDatasetCounts = {
  products: number;
  batches: number;
  orders: number;
  movements: number;
  returns: number;
  open_anomalies: number;
};

export type DemoDatasetStatus = {
  demo_mode: boolean;
  dataset_key: "stokledger-demo-v1";
  generation: number;
  last_reset_at: string | null;
  ready: boolean;
  counts: DemoDatasetCounts;
};

export type DemoResetResult = {
  status: "RESET";
  dataset_key: "stokledger-demo-v1";
  generation: number;
  reset_at: string;
  counts: DemoDatasetCounts;
  judge_start: {
    product_id: string;
    reserved_order_id: string;
    receipt_command_id: string;
  };
};

export function proofStatusLabel(status: ProofStatus): string {
  return status === "PASS" ? "Sesuai" : "Perlu ditinjau";
}

export function integritySeverityLabel(
  severity: IntegrityCheck["severity"],
): string {
  return severity === "CRITICAL"
    ? "Segera ditangani jika gagal"
    : "Ditinjau jika gagal";
}

export function integrityCheckCopy(check: IntegrityCheck): {
  title: string;
  summary: string;
} {
  const copy: Record<
    IntegrityCheck["id"],
    { title: string; pass: string; fail: string }
  > = {
    projection_equals_ledger: {
      title: "Saldo sesuai dengan riwayat stok",
      pass: "Saldo setiap batch cocok dengan total seluruh pergerakan stok.",
      fail: "Ada saldo batch yang berbeda dari total pergerakan stok.",
    },
    no_negative_batch: {
      title: "Tidak ada saldo batch di bawah nol",
      pass: "Semua batch memiliki saldo nol atau lebih.",
      fail: "Ada batch dengan saldo kurang dari nol.",
    },
    no_duplicate_applied_event: {
      title: "Event marketplace tidak mengubah stok dua kali",
      pass: "Pengiriman ulang event tidak membuat perubahan stok tambahan.",
      fail: "Ada event marketplace yang mengubah stok lebih dari satu kali.",
    },
    no_orphan_movement: {
      title: "Pergerakan marketplace terhubung ke order",
      pass: "Setiap perubahan stok marketplace memiliki order asal.",
      fail: "Ada perubahan stok marketplace tanpa order asal yang valid.",
    },
    valid_order_status: {
      title: "Status order sesuai dengan jumlah barang",
      pass: "Status order cocok dengan jumlah dialokasikan, dikirim, dan dibatalkan.",
      fail: "Ada status order yang tidak sesuai dengan jumlah barangnya.",
    },
    no_over_return: {
      title: "Jumlah retur tidak melebihi pengiriman",
      pass: "Jumlah barang diretur tidak melebihi jumlah yang pernah dikirim.",
      fail: "Ada retur dengan jumlah lebih besar dari barang yang pernah dikirim.",
    },
    movement_groups_reconciled: {
      title: "Setiap transaksi memiliki riwayat stok",
      pass: "Semua transaksi stok memiliki catatan pergerakan yang lengkap.",
      fail: "Ada transaksi stok tanpa catatan pergerakan yang lengkap.",
    },
    append_only_guard_active: {
      title: "Riwayat stok terlindungi dari perubahan langsung",
      pass: "Catatan lama tidak dapat diubah atau dihapus langsung.",
      fail: "Perlindungan terhadap perubahan langsung sedang tidak aktif.",
    },
  };
  const item = copy[check.id];

  return {
    title: item.title,
    summary: check.status === "PASS" ? item.pass : item.fail,
  };
}

export function integrityChallengeCopy(
  scenario: IntegrityChallengeScenario,
): { title: string; summary: string } {
  const copy: Record<string, { title: string; summary: string }> = {
    duplicate_shipped_event: {
      title: "Event pengiriman tidak diproses dua kali",
      summary: "Pengiriman ulang event yang sama hanya menghasilkan satu perubahan stok.",
    },
    concurrent_allocation: {
      title: "Alokasi bersamaan tetap aman",
      summary: "Ketika dua permintaan bersaing, hanya permintaan dengan stok cukup yang diterima.",
    },
    insufficient_stock: {
      title: "Permintaan melebihi stok ditolak",
      summary: "Transaksi ditolak tanpa mengubah sebagian saldo.",
    },
    bundle_atomic_failure: {
      title: "Bundle gagal sebagai satu transaksi",
      summary: "Jika satu komponen tidak tersedia, seluruh perubahan bundle dibatalkan.",
    },
    cancellation_with_promo: {
      title: "Pembatalan mengembalikan produk dan bonus",
      summary: "Produk utama dan bonus dikembalikan bersama hingga perubahan bersih menjadi nol.",
    },
    partial_return: {
      title: "Retur parsial dibatasi oleh jumlah pengiriman",
      summary: "Retur yang valid diterima dan jumlah berlebih berikutnya ditolak.",
    },
    projection_rebuild: {
      title: "Saldo dapat dibangun ulang dari riwayat",
      summary: "Saldo yang keliru dapat dihitung ulang menjadi nilai yang sesuai dengan riwayat stok.",
    },
    ledger_mutation_rejection: {
      title: "Riwayat lama tidak dapat diubah langsung",
      summary: "Percobaan mengubah catatan lama ditolak dan data utama tetap sama.",
    },
  };

  return copy[scenario.id] ?? {
    title: scenario.title,
    summary: scenario.summary,
  };
}

export function integrityEvidenceLabel(key: string): string {
  const labels: Record<string, string> = {
    applied_rows: "Perubahan diterapkan",
    first_applied: "Permintaan pertama diterapkan",
    second_applied: "Permintaan kedua diterapkan",
    remaining_qty: "Stok tersisa",
    can_commit: "Transaksi dapat disimpan",
    component_a_qty: "Jumlah komponen A",
    component_b_qty: "Jumlah komponen B",
    net_qty: "Perubahan bersih",
    reversal_count: "Jumlah catatan pembalik",
    accepted_rows: "Retur diterima",
    rejected_rows: "Retur ditolak",
    returned_qty: "Jumlah diretur",
    before_qty: "Saldo sebelum",
    after_qty: "Saldo sesudah",
    ledger_qty: "Saldo menurut riwayat",
    guard_active: "Perlindungan aktif",
    main_dataset_unchanged: "Data utama tidak berubah",
  };

  return labels[key] ?? key.replaceAll("_", " ");
}
