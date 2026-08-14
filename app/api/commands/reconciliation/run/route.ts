import {
  handleAuthenticatedPost,
  optionalDateTime,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const result = await supabase.rpc("run_daily_reconciliation", {
      p_as_of: optionalDateTime(body, "asOf"),
    });

    return unwrapRpc(result, "Reconciliation belum dapat dijalankan.");
  });
}
