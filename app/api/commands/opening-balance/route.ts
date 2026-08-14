import {
  handleAuthenticatedPost,
  optionalDateTime,
  optionalString,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("record_opening_balance", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_product_id: requiredUuid(body, "productId", "Produk"),
      p_batch_id: requiredUuid(body, "batchId", "Batch"),
      p_qty: requiredPositiveInteger(body, "qty", "Kuantitas"),
      p_reference: optionalString(body, "reference"),
      p_occurred_at: optionalDateTime(body, "occurredAt"),
    });

    return unwrapRpc(result, "Opening balance belum dapat diposting.");
  });
}
