import {
  handleAuthenticatedPost,
  optionalString,
  requiredString,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const id = optionalString(body, "id");
    const sku = requiredString(body, "sku", "SKU");
    const name = requiredString(body, "name", "Nama produk");
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

    const result = await supabase.rpc("save_product", {
      p_id: id,
      p_sku: sku,
      p_name: name,
      p_is_active: isActive,
    });

    return unwrapRpc(result, "Produk belum dapat disimpan.");
  });
}
