"use client";

import { Panel } from "@/components/panel";

import { Button } from "@/components/ui/button";

export default function ExplainBalanceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="app-content">
      <Panel className="error-panel" role="alert">
        <h2>Penjelasan saldo belum dapat dimuat.</h2>
        <p>
          Saldo tidak diubah. Coba hitung kembali ketika koneksi database sudah
          stabil.
        </p>
        <Button className="h-11 w-fit px-5" onClick={reset} type="button">
          Hitung ulang
        </Button>
      </Panel>
    </div>
  );
}
