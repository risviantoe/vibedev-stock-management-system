import {
  handleAuthenticatedPost,
  InputError,
  optionalString,
  requiredEnum,
  requiredString,
  requiredUuid,
} from "@/lib/api/route";

const errorMessages: Record<string, string> = {
  PRODUCT_NOT_FOUND: "Produk tidak ditemukan.",
  PRODUCT_MARKETPLACE_LISTING_NOT_FOUND:
    "Marketplace listing produk tidak ditemukan.",
  INVALID_MARKETPLACE_CHANNEL: "Channel marketplace tidak valid.",
  INVALID_MARKETPLACE_LISTING_SKU:
    "Listing SKU wajib diisi dan maksimal 100 karakter.",
  INACTIVE_PRODUCT_CANNOT_HAVE_ACTIVE_LISTING:
    "Aktifkan produk terlebih dahulu sebelum mengaktifkan listing.",
  MARKETPLACE_LISTING_SKU_ALREADY_EXISTS:
    "Listing SKU tersebut sudah dipakai pada channel yang sama.",
};

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const listingId = optionalString(body, "listingId");

    if (typeof body.isActive !== "boolean") {
      throw new InputError("Status listing tidak valid.");
    }

    const result = await supabase.rpc("save_product_marketplace_listing", {
      p_id: listingId
        ? requiredUuid({ listingId }, "listingId", "Listing")
        : null,
      p_product_id: requiredUuid(body, "productId", "Produk"),
      p_channel: requiredEnum(
        body,
        "channel",
        "Channel",
        ["SHOPEE", "TIKTOK"] as const,
      ),
      p_listing_sku: requiredString(body, "listingSku", "Listing SKU"),
      p_is_active: body.isActive,
    });

    if (result.error || result.data === null) {
      const code = result.error?.message ?? "";
      throw new InputError(
        errorMessages[code] ?? "Marketplace listing belum dapat disimpan.",
      );
    }

    return result.data;
  });
}
