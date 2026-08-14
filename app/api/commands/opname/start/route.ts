import {
  handleAuthenticatedPost,
  optionalDateTime,
  requiredString,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("start_opname_session", {
      p_idempotency_key: requiredString(
        body,
        "idempotencyKey",
        "Idempotency key",
      ),
      p_started_at: optionalDateTime(body, "startedAt"),
    });

    return unwrapRpc(result, "Sesi opname belum dapat dimulai.");
  });
}
