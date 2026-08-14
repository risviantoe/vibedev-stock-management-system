import "server-only";

import type {
  DemoDatasetStatus,
  IntegrityReport,
  ProductBalanceExplanation,
} from "@/lib/domain/proof";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getProductBalanceExplanation(
  productId: string,
): Promise<ProductBalanceExplanation> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("explain_product_balance", {
    p_product_id: productId,
  });

  if (error || !data) {
    throw new Error(
      `Penjelasan saldo belum dapat dimuat: ${error?.message ?? "data tidak tersedia"}`,
    );
  }

  return data as ProductBalanceExplanation;
}

export async function getIntegrityReport(): Promise<IntegrityReport> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_integrity_report");

  if (error || !data) {
    throw new Error(
      `Integrity report belum dapat dimuat: ${error?.message ?? "data tidak tersedia"}`,
    );
  }

  return data as IntegrityReport;
}

export async function getDemoDatasetStatus(): Promise<DemoDatasetStatus> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_demo_dataset_status");

  if (error || !data) {
    throw new Error(
      `Status demo belum dapat dimuat: ${error?.message ?? "data tidak tersedia"}`,
    );
  }

  return data as DemoDatasetStatus;
}
