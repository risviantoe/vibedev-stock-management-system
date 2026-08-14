import {
  handleAuthenticatedPost,
  InputError,
  optionalDateTime,
  requiredEnum,
  requiredPositiveInteger,
  requiredString,
  unwrapRpc,
} from "@/lib/api/route";
import {
  MARKETPLACE_EVENT_TYPES,
  type CanonicalMarketplaceItem,
} from "@/lib/domain/marketplace";

const channels = ["SHOPEE", "TIKTOK"] as const;

function readItems(
  body: Record<string, unknown>,
  eventType: (typeof MARKETPLACE_EVENT_TYPES)[number],
): CanonicalMarketplaceItem[] {
  const value = body.items;
  if (!Array.isArray(value)) {
    throw new InputError("Daftar item harus berupa array.");
  }

  if (eventType === "ORDER_SHIPPED") {
    return [];
  }

  if (!value.length) {
    throw new InputError("Minimal satu item wajib diisi.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new InputError(`Item ${index + 1} tidak valid.`);
    }
    const object = item as Record<string, unknown>;
    const externalLineId = requiredString(
      object,
      "externalLineId",
      `Line ID item ${index + 1}`,
    );
    const quantity = requiredPositiveInteger(
      object,
      "quantity",
      `Quantity item ${index + 1}`,
    );

    if (eventType === "ORDER_CREATED") {
      return {
        external_line_id: externalLineId,
        listing_sku: requiredString(
          object,
          "listingSku",
          `Listing item ${index + 1}`,
        ).toUpperCase(),
        quantity,
      };
    }

    return {
      external_line_id: externalLineId,
      quantity,
    };
  });
}

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const eventType = requiredEnum(
      body,
      "eventType",
      "Tipe event",
      MARKETPLACE_EVENT_TYPES,
    );
    const channel = requiredEnum(
      body,
      "channel",
      "Channel",
      channels,
    );
    const items = readItems(body, eventType);
    const occurredAt = optionalDateTime(body, "occurredAt");
    const externalEventId = requiredString(
      body,
      "externalEventId",
      "External event ID",
    );
    const externalOrderId = requiredString(
      body,
      "externalOrderId",
      "External order ID",
    );

    const result = await supabase.rpc("ingest_marketplace_event", {
      p_source: "SIMULATOR",
      p_external_event_id: externalEventId,
      p_channel: channel,
      p_event_type: eventType,
      p_external_order_id: externalOrderId,
      p_items: items,
      p_occurred_at: occurredAt,
      p_raw_payload: {
        adapter: "SIMULATOR",
        external_event_id: externalEventId,
        channel,
        event_type: eventType,
        external_order_id: externalOrderId,
        occurred_at: occurredAt,
        items,
      },
    });

    return unwrapRpc(result, "Event marketplace belum dapat diproses.");
  });
}
