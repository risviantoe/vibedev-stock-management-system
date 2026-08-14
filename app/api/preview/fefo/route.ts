import {
  handleAuthenticatedPost,
  requiredPositiveInteger,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("preview_fefo_allocation", {
      p_product_id: requiredUuid(body, "productId", "Produk"),
      p_qty: requiredPositiveInteger(body, "qty", "Kuantitas"),
    });

    return unwrapRpc(result, "Alokasi FEFO belum dapat dihitung.");
  });
}
