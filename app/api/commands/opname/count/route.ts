import {
  handleAuthenticatedPost,
  InputError,
  requiredUuid,
  unwrapRpc,
} from "@/lib/api/route";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    const physicalQty = Number(body.physicalQty);
    if (!Number.isSafeInteger(physicalQty) || physicalQty < 0) {
      throw new InputError(
        "Kuantitas fisik harus bilangan bulat 0 atau lebih.",
      );
    }

    const result = await supabase.rpc("save_opname_count", {
      p_session_id: requiredUuid(body, "sessionId", "Sesi opname"),
      p_batch_id: requiredUuid(body, "batchId", "Batch"),
      p_physical_qty: physicalQty,
    });

    return unwrapRpc(result, "Hitung fisik belum dapat disimpan.");
  });
}
