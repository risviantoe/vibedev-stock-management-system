import {
  handleAuthenticatedPost,
  optionalDateTime,
  requiredDate,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("receive_goods", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_product_id: requiredUuid(body, "productId", "Produk"),
      p_batch_code: requiredString(body, "batchCode", "Kode batch"),
      p_expiry_date: requiredDate(body, "expiryDate", "Tanggal expiry"),
      p_qty: requiredPositiveInteger(body, "qty", "Kuantitas"),
      p_reference: requiredString(body, "reference", "Referensi maklon"),
      p_occurred_at: optionalDateTime(body, "occurredAt"),
    });

    return unwrapRpc(result, "Barang masuk belum dapat diposting.");
  });
}
