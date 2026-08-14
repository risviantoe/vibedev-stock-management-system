import {
  handleAuthenticatedPost,
  requiredDate,
  requiredEnum,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

const batchSources = ["PRODUCTION", "RETURN"] as const;

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const productId = requiredUuid(body, "productId", "Produk");
    const batchCode = requiredString(body, "batchCode", "Kode batch");
    const expiryDate = requiredDate(body, "expiryDate", "Tanggal expiry");
    const sourceType = requiredEnum(
      body,
      "sourceType",
      "Sumber batch",
      batchSources,
    );

    const result = await supabase.rpc("create_batch", {
      p_product_id: productId,
      p_batch_code: batchCode,
      p_expiry_date: expiryDate,
      p_source_type: sourceType,
    });

    return unwrapRpc(result, "Batch belum dapat dibuat.");
  });
}
