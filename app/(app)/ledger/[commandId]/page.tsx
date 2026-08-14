import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { notFound } from "next/navigation";
import { CopyCheck, ShieldCheck, ShieldX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { TechnicalDetails } from "@/components/technical-details";
import {
  channelLabel,
  commandLabel,
  formatDate,
  formatDateTime,
  formatQuantity,
  reasonLabel,
} from "@/lib/domain/inventory";
import { getCommandReceipt } from "@/lib/data/inventory";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ commandId: string }>;
}) {
  const { commandId } = await params;
  const receipt = await getCommandReceipt(commandId);

  if (!receipt) {
    notFound();
  }

  const tone =
    receipt.outcome === "APPLIED"
      ? "success"
      : receipt.outcome === "DUPLICATE"
        ? "info"
        : "danger";
  const outcomeLabel =
    receipt.outcome === "APPLIED"
      ? "Berhasil"
      : receipt.outcome === "DUPLICATE"
        ? "Sudah pernah diproses"
        : "Ditolak";
  const outcomeTitle =
    receipt.outcome === "APPLIED"
      ? "Transaksi tercatat utuh"
      : receipt.outcome === "DUPLICATE"
        ? "Stok tetap konsisten"
        : "Stok tidak berubah";
  const OutcomeIcon =
    receipt.outcome === "APPLIED"
      ? ShieldCheck
      : receipt.outcome === "DUPLICATE"
        ? CopyCheck
        : ShieldX;

  return (
    <>
      <PageHeader
        actions={
          <LinkButton className="h-11 px-5" href="/ledger" variant="outline">
            ← Kembali ke riwayat stok
          </LinkButton>
        }
        description="Lihat hasil transaksi, perubahan saldo, dan rincian setiap batch."
        title={commandLabel(receipt.command_type)}
      />

      <div className="app-content receipt-content">
        <section
          aria-labelledby="receipt-outcome-title"
          className={`receipt-hero receipt-${tone}`}
        >
          <span className="receipt-seal" aria-hidden="true">
            <OutcomeIcon size={28} strokeWidth={2.1} />
          </span>
          <div>
            <h2 id="receipt-outcome-title">{outcomeTitle}</h2>
            <p>
              {receipt.outcome === "APPLIED"
                ? "Seluruh perubahan stok berhasil disimpan sebagai satu transaksi."
                : receipt.outcome === "DUPLICATE"
                  ? "Transaksi yang sama sudah pernah diproses; stok tidak diubah lagi."
                  : "Transaksi ditolak dan tidak mengubah sebagian stok."}
            </p>
          </div>
          <StatusPill tone={tone}>{outcomeLabel}</StatusPill>
        </section>

        <section className="receipt-metadata">
          <div>
            <span>Perubahan stok</span>
            <strong>{formatQuantity(receipt.movements.length)} pergerakan</strong>
          </div>
          <div>
            <span>Diproses</span>
            <strong>{formatDateTime(receipt.completed_at ?? receipt.created_at)}</strong>
          </div>
          <div className="receipt-technical-details">
            <TechnicalDetails
              className="mt-0"
              summary="Lihat bukti teknis transaksi"
              items={[
                { label: "ID transaksi", value: receipt.command_id },
                {
                  label: "ID grup pergerakan",
                  value: receipt.movement_group_id ?? "—",
                },
                { label: "Kunci transaksi unik", value: receipt.idempotency_key },
                { label: "Jenis perintah", value: receipt.command_type },
              ]}
            />
          </div>
        </section>

        {receipt.error ? (
          <section className="receipt-error">
            <strong>Transaksi tidak dapat disimpan.</strong>
            <p>{receipt.error.message}</p>
            <p>Saldo dan riwayat stok tidak berubah untuk transaksi ini.</p>
            <TechnicalDetails
              items={[
                { label: "Kode kesalahan", value: receipt.error.code },
                { label: "ID transaksi", value: receipt.command_id },
              ]}
            />
          </section>
        ) : null}

        <Panel>
          <div className="section-heading">
            <div>
              <h2>
                {formatQuantity(receipt.movements.length)} pergerakan stok
              </h2>
            </div>
            <StatusPill tone="info">Rincian per batch</StatusPill>
          </div>

          {receipt.movements.length ? (
            <div className="receipt-lines">
              {receipt.movements.map((movement, index) => (
                <article className="receipt-line" key={movement.movement_id}>
                  <span className="receipt-line-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="receipt-product">
                    <span>{movement.product_sku}</span>
                    <strong>{movement.product_name}</strong>
                    <p>
                      {movement.batch_code} · kedaluwarsa{" "}
                      {formatDate(movement.expiry_date)}
                    </p>
                  </div>
                  <div className="receipt-classification">
                    <span>{reasonLabel(movement.reason)}</span>
                    <strong>{channelLabel(movement.channel)}</strong>
                    <p>{movement.reference ?? "Tanpa referensi tambahan"}</p>
                  </div>
                  <div className="balance-proof">
                    <span>Saldo batch</span>
                    <div>
                      <strong>{formatQuantity(movement.balance_before)}</strong>
                      <b>→</b>
                      <strong>{formatQuantity(movement.balance_after)}</strong>
                    </div>
                  </div>
                  <span
                    className={`receipt-delta ${
                      movement.qty_delta > 0 ? "positive" : "negative"
                    }`}
                  >
                    {movement.qty_delta > 0 ? "+" : ""}
                    {formatQuantity(movement.qty_delta)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Transaksi ditolak tanpa mengubah sebagian saldo."
              title="Tidak ada pergerakan stok yang dicatat."
            />
          )}
        </Panel>

      </div>
    </>
  );
}
