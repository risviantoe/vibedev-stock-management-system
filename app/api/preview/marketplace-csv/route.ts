import {
  handleAuthenticatedPost,
  InputError,
  requiredString,
} from "@/lib/api/route";
import { previewMarketplaceCsv } from "@/lib/domain/marketplace";

export async function POST(request: Request) {
  return handleAuthenticatedPost(request, async (_supabase, body) => {
    try {
      return previewMarketplaceCsv(
        requiredString(body, "csv", "Isi CSV"),
      );
    } catch (error) {
      throw new InputError(
        error instanceof Error ? error.message : "CSV tidak valid.",
      );
    }
  });
}
