"use client";

import { Panel } from "@/components/panel";

import { Button } from "@/components/ui/button";

export default function IntegrityError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="app-content">
      <Panel className="error-panel" role="alert">
        <h2>Pemeriksaan stok belum dapat diselesaikan.</h2>
        <p>
          Tidak ada perubahan data yang dilakukan. Periksa koneksi database
          lalu jalankan ulang pemeriksaan.
        </p>
        <Button className="h-11 w-fit px-5" onClick={reset} type="button">
          Coba lagi
        </Button>
      </Panel>
    </div>
  );
}
