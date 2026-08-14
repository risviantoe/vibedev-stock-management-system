import {
  handleAuthenticatedPost,
  optionalDateTime,
  requiredDate,
  requiredEnum,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const condition = requiredEnum(
      body,
      "condition",
      "Kondisi",
      ["SELLABLE", "DAMAGED", "LOST"] as const,
    );

    const result = await supabase.rpc("inspect_return_item", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_return_item_id: requiredUuid(body, "returnItemId", "Return item"),
      p_condition: condition,
      p_batch_code:
        condition === "SELLABLE"
          ? requiredString(body, "batchCode", "Batch return")
          : null,
      p_expiry_date:
        condition === "SELLABLE"
          ? requiredDate(body, "expiryDate", "Expiry return")
          : null,
      p_occurred_at: optionalDateTime(body, "occurredAt"),
    });

    return unwrapRpc(result, "Inspeksi return belum dapat disimpan.");
  });
}
