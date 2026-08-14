import { PageLoadingState } from "@/components/ui/loading-indicator";

export default function ExplainBalanceLoading() {
  return (
    <PageLoadingState
      description="Sistem sedang mengelompokkan setiap barang masuk dan keluar untuk menjelaskan saldo produk."
      title="Menghitung ulang saldo…"
    />
  );
}
