import {
  handleAuthenticatedPost,
  optionalDateTime,
  optionalString,
  requiredEnum,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

const reasons = [
  "OFFLINE_SALE",
  "BONUS",
  "PROMO",
  "SAMPLE",
  "DAMAGED",
  "EXPIRED",
] as const;

const channels = ["SHOPEE", "TIKTOK", "OFFLINE", "INTERNAL"] as const;

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("post_manual_outbound", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_product_id: requiredUuid(body, "productId", "Produk"),
      p_qty: requiredPositiveInteger(body, "qty", "Kuantitas"),
      p_reason: requiredEnum(body, "reason", "Alasan", reasons),
      p_channel: requiredEnum(body, "channel", "Channel", channels),
      p_reference: optionalString(body, "reference"),
      p_occurred_at: optionalDateTime(body, "occurredAt"),
    });

    return unwrapRpc(result, "Manual outbound belum dapat diposting.");
  });
}
