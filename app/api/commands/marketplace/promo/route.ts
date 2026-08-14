import {
  handleAuthenticatedPost,
  optionalDateTime,
  requiredEnum,
  requiredPositiveInteger,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

const channels = ["SHOPEE", "TIKTOK"] as const;

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("save_promo_rule", {
      p_name: requiredString(body, "name", "Nama promo"),
      p_channel: requiredEnum(body, "channel", "Channel", channels),
      p_start_at: optionalDateTime(body, "startAt"),
      p_end_at: optionalDateTime(body, "endAt"),
      p_trigger_product_id: requiredUuid(
        body,
        "triggerProductId",
        "Produk pemicu",
      ),
      p_trigger_qty: requiredPositiveInteger(
        body,
        "triggerQty",
        "Quantity pemicu",
      ),
      p_free_product_id: requiredUuid(
        body,
        "freeProductId",
        "Produk bonus",
      ),
      p_free_qty: requiredPositiveInteger(
        body,
        "freeQty",
        "Quantity bonus",
      ),
    });

    return unwrapRpc(result, "Promo belum dapat disimpan.");
  });
}
