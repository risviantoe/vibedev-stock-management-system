import {
  handleAuthenticatedPost,
  InputError,
  optionalDateTime,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    if (!Array.isArray(body.components) || !body.components.length) {
      throw new InputError("Minimal satu komponen bundle wajib diisi.");
    }

    const components = body.components.map((component, index) => {
      if (
        !component ||
        typeof component !== "object" ||
        Array.isArray(component)
      ) {
        throw new InputError(`Komponen ${index + 1} tidak valid.`);
      }
      const object = component as Record<string, unknown>;
      return {
        product_id: requiredUuid(
          object,
          "productId",
          `Produk komponen ${index + 1}`,
        ),
        qty: requiredPositiveInteger(
          object,
          "qty",
          `Quantity komponen ${index + 1}`,
        ),
      };
    });

    const result = await supabase.rpc("save_bundle_recipe", {
      p_sku: requiredString(body, "sku", "SKU bundle"),
      p_name: requiredString(body, "name", "Nama bundle"),
      p_components: components,
      p_effective_from: optionalDateTime(body, "effectiveFrom"),
    });

    return unwrapRpc(result, "Recipe bundle belum dapat disimpan.");
  });
}
