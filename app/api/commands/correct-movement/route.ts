import {
  handleAuthenticatedPost,
  optionalDateTime,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("correct_movement", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_movement_id: requiredUuid(body, "movementId", "Movement"),
      p_note: requiredString(body, "note", "Catatan koreksi"),
      p_occurred_at: optionalDateTime(body, "occurredAt"),
    });

    return unwrapRpc(result, "Movement belum dapat dikoreksi.");
  });
}
