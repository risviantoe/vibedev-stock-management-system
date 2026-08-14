import {
  handleAuthenticatedPost,
  InputError,
  optionalDateTime,
  requiredEnum,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    if (!Array.isArray(body.items) || !body.items.length) {
      throw new InputError("Minimal satu item return wajib diisi.");
    }

    const items = body.items.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new InputError(`Item return ${index + 1} tidak valid.`);
      }
      const object = item as Record<string, unknown>;
      return {
        order_item_id: requiredUuid(
          object,
          "orderItemId",
          `Order item ${index + 1}`,
        ),
        product_id: requiredUuid(
          object,
          "productId",
          `Produk ${index + 1}`,
        ),
        qty: requiredPositiveInteger(
          object,
          "qty",
          `Quantity return ${index + 1}`,
        ),
      };
    });

    const result = await supabase.rpc("create_return", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_channel: requiredEnum(
        body,
        "channel",
        "Channel",
        ["SHOPEE", "TIKTOK"] as const,
      ),
      p_external_order_id: requiredString(
        body,
        "externalOrderId",
        "External order ID",
      ),
      p_external_return_id: requiredString(
        body,
        "externalReturnId",
        "External return ID",
      ),
      p_items: items,
      p_created_at: optionalDateTime(body, "createdAt"),
    });

    return unwrapRpc(result, "Return belum dapat dibuat.");
  });
}
