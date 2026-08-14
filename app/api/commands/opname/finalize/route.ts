import {
  handleAuthenticatedPost,
  optionalDateTime,
  requiredString,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("finalize_opname_session", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_session_id: requiredUuid(body, "sessionId", "Sesi opname"),
      p_occurred_at: optionalDateTime(body, "occurredAt"),
    });

    return unwrapRpc(result, "Sesi opname belum dapat difinalisasi.");
  });
}
