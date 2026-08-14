import {
  handleAuthenticatedPost,
  InputError,
  requiredString,
  unwrapRpc,
} from "@/lib/api/route";
import { previewMarketplaceCsv } from "@/lib/domain/marketplace";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (supabase, body) => {
    let preview;
    try {
      preview = previewMarketplaceCsv(
        requiredString(body, "csv", "Isi CSV"),
      );
    } catch (error) {
      throw new InputError(
        error instanceof Error ? error.message : "CSV tidak valid.",
      );
    }

    if (!preview.valid) {
      throw new InputError(
        "CSV masih memiliki baris tidak valid. Perbaiki sebelum import.",
      );
    }

    const result = await supabase.rpc("ingest_marketplace_event_batch", {
      p_events: preview.events,
    });

    return {
      preview: preview.summary,
      results: unwrapRpc(
        result,
        "Batch event marketplace belum dapat diproses.",
      ),
    };
  });
}
