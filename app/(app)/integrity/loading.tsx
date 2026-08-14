import { PageLoadingState } from "@/components/ui/loading-indicator";

export default function IntegrityLoading() {
  return (
    <PageLoadingState
      description="Sistem sedang mencocokkan saldo tersimpan dengan riwayat pergerakan stok terbaru."
      title="Memeriksa konsistensi data…"
    />
  );
}
