import {
  handleAuthenticatedPost,
  requiredString,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const confirmation = requiredString(
      body,
      "confirmation",
      "Konfirmasi reset",
    );
    const result = await supabase.rpc("reset_demo_dataset", {
      p_confirmation: confirmation,
    });

    return unwrapRpc(result, "Demo dataset belum dapat di-reset.");
  });
}
