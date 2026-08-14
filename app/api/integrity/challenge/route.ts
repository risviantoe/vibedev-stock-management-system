import { handleAuthenticatedPost, unwrapRpc } from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase) => {
    const result = await supabase.rpc("run_integrity_challenge");

    return unwrapRpc(result, "Integrity Challenge belum dapat dijalankan.");
  });
}
