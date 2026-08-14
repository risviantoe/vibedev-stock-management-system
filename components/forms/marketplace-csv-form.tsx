"use client";

import { toast } from "sonner";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client/api";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import {
  ConfirmationPreview,
  ConfirmationPreviewContent,
  ConfirmationPreviewHeader,
} from "@/components/confirmation-preview";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  CsvMarketplacePreview,
  MarketplaceEventReceipt,
} from "@/lib/domain/marketplace";

const exampleCsv = `external_event_id,channel,event_type,external_order_id,occurred_at,external_line_id,listing_sku,quantity
CSV-EVT-001,SHOPEE,ORDER_CREATED,CSV-ORDER-001,2026-07-26T08:00:00Z,LINE-1,SER-NIAC-020,2
CSV-EVT-001,SHOPEE,ORDER_CREATED,CSV-ORDER-001,2026-07-26T08:00:00Z,LINE-2,CLN-GENTLE-100,1`;

export function MarketplaceCsvForm() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<CsvMarketplacePreview | null>(null);
  const [results, setResults] = useState<MarketplaceEventReceipt[] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function previewCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults(null);
    try {
      const response = await postJson<CsvMarketplacePreview>(
        "/api/preview/marketplace-csv",
        { csv },
      );
      setPreview(response);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "CSV belum dapat dibaca.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function importCsv() {
    if (!preview?.valid) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await postJson<{
        results: MarketplaceEventReceipt[];
      }>("/api/commands/marketplace/import", { csv });
      toast.success("Impor CSV berhasil diproses.", {
        description: `${response.results.length} baris transaksi marketplace berhasil diimpor.`,
      });
      setResults(response.results);
      setPreview(null);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Import marketplace belum dapat diproses.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="operational-form command-card" onSubmit={previewCsv}>
      <TextareaField
        description="Satu event multi-item dapat memakai beberapa baris dengan event ID yang sama."
        label="Data event marketplace"
        onChange={(event) => {
          setCsv(event.target.value);
          setPreview(null);
          setResults(null);
          setError(null);
        }}
        placeholder={exampleCsv}
        rows={8}
        textareaClassName="min-h-48 font-mono text-sm md:text-sm"
        value={csv}
      />

      {!csv ? (
        <Button
          className="h-8 w-fit px-0"
          onClick={() => setCsv(exampleCsv)}
          type="button"
          variant="link"
        >
          Gunakan contoh CSV
        </Button>
      ) : null}

      {preview ? (
        <ConfirmationPreview>
          <ConfirmationPreviewHeader
            action={
              <StatusPill tone={preview.valid ? "success" : "danger"}>
                {preview.valid
                  ? "Siap diimpor"
                  : `${preview.summary.invalidRowCount} baris bermasalah`}
              </StatusPill>
            }
            eyebrow="Hasil pemeriksaan CSV"
            title={`${preview.summary.eventCount} event dari ${preview.summary.rowCount} baris`}
          />
          <ConfirmationPreviewContent className="overflow-x-auto">
            <Table className="min-w-[42rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Baris</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Validasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={`${row.row}-${row.external_event_id}`}>
                    <TableCell>{row.row}</TableCell>
                    <TableCell>{row.external_event_id || "—"}</TableCell>
                    <TableCell>{row.external_order_id || "—"}</TableCell>
                    <TableCell>{row.valid ? "Valid" : row.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ConfirmationPreviewContent>
        </ConfirmationPreview>
      ) : null}

      {results ? (
        <section className="command-result result-applied">
          <div>
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              Laporan impor
            </span>
            <strong>{results.length} event selesai diproses</strong>
            <p>
              {results.filter((result) => result.outcome === "APPLIED").length}{" "}
              applied ·{" "}
              {results.filter((result) => result.outcome === "DUPLICATE").length}{" "}
              duplicate ·{" "}
              {results.filter((result) => result.outcome === "REJECTED").length}{" "}
              rejected
            </p>
          </div>
          {results[0]?.event ? (
            <Link href={`/marketplace/events/${results[0].event.id}`}>
              Buka hasil pertama →
            </Link>
          ) : null}
        </section>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <div className="form-actions">
        {preview ? (
          <Button
            className="h-11 px-5"
            onClick={() => setPreview(null)}
            type="button"
            variant="outline"
          >
            Ubah CSV
          </Button>
        ) : null}
        {preview ? (
          <Button
            className="h-11 px-5"
            isDisabled={isLoading || !preview.valid}
            onClick={importCsv}
            type="button"
          >
            <ButtonContent isLoading={isLoading} loadingLabel="Mengimpor data…">
              Konfirmasi impor
            </ButtonContent>
          </Button>
        ) : (
          <Button
            className="h-11 px-5"
            isDisabled={isLoading || !csv.trim()}
            type="submit"
          >
            <ButtonContent isLoading={isLoading} loadingLabel="Memeriksa CSV…">
              Periksa CSV
            </ButtonContent>
          </Button>
        )}
      </div>
    </form>
  );
}
