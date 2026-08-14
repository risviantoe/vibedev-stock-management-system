import { LinkButton } from "@/components/ui/button";
import { DemoResetForm } from "@/components/forms/demo-reset-form";
import { IntegrityChallengeForm } from "@/components/forms/integrity-challenge-form";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { TechnicalDetails } from "@/components/technical-details";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getDemoDatasetStatus, getIntegrityReport } from "@/lib/data/proof";
import { formatDateTime, formatQuantity } from "@/lib/domain/inventory";
import {
  integrityCheckCopy,
  integritySeverityLabel,
  proofStatusLabel,
} from "@/lib/domain/proof";

export default async function IntegrityPage() {
  const [report, demoStatus] = await Promise.all([
    getIntegrityReport(),
    getDemoDatasetStatus(),
  ]);
  const passed = report.checks.filter((check) => check.status === "PASS");
  const integrityIsSafe = report.overall_status === "PASS";
  const hasOperationalDifferences = report.open_anomaly_count > 0;

  return (
    <>
      <PageHeader
        actions={
          hasOperationalDifferences ? (
            <LinkButton className="h-11 px-5" href="/reconciliation">
              Tinjau {formatQuantity(report.open_anomaly_count)} perbedaan
            </LinkButton>
          ) : undefined
        }
        description="Pastikan riwayat stok terlindungi dan saldo tersimpan sesuai dengan seluruh pergerakan."
        title="Pemeriksaan Stok"
      />

      <div className="app-content">
        <section
          className={`integrity-hero integrity-hero-${report.overall_status.toLowerCase()}`}
        >
          <div>
            <h2>
              {integrityIsSafe
                ? "Riwayat dan saldo stok konsisten."
                : "Ada data stok yang perlu ditinjau."}
            </h2>
            <p>
              {!integrityIsSafe
                ? "Periksa kontrol yang gagal sebelum melanjutkan transaksi stok terkait."
                : hasOperationalDifferences
                  ? `Pemeriksaan integritas berhasil. ${formatQuantity(report.open_anomaly_count)} perbedaan operasional tetap perlu ditangani melalui Rekonsiliasi.`
                  : "Tidak ditemukan perbedaan antara saldo tersimpan dan riwayat stok terbaru."}
            </p>
          </div>
          <div className="integrity-score">
            <strong>
              {passed.length}/{report.checks.length}
            </strong>
            <span>pemeriksaan berhasil</span>
            <small>{formatDateTime(report.generated_at)}</small>
          </div>
        </section>

        <section className="metric-grid metric-grid-three operational-metrics">
          <MetricCard description="Riwayat transaksi yang tidak dapat ditimpa" label="Pergerakan stok" value={formatQuantity(report.movement_count)} />
          <MetricCard description="Dibandingkan ulang dengan seluruh pergerakan" label="Saldo tersimpan" value={formatQuantity(report.projection_count)} />
          <MetricCard
            description={hasOperationalDifferences ? "Tindak lanjuti melalui Rekonsiliasi" : "Tidak ada tindakan tambahan"}
            label="Perbedaan data terbuka"
            value={formatQuantity(report.open_anomaly_count)}
          />
        </section>

        <Panel>
          <div className="section-heading">
            <div>
              <h2>Pemeriksaan konsistensi data</h2>
            </div>
            <StatusPill
              tone={report.overall_status === "PASS" ? "success" : "danger"}
            >
              {report.overall_status === "PASS"
                ? "Semua pemeriksaan berhasil"
                : `${report.failed_count} gagal`}
            </StatusPill>
          </div>
          <p className="section-description">
            Pemeriksaan di bawah memastikan fondasi riwayat dan saldo bekerja
            dengan benar. Perbedaan order, retur, atau data operasional tetap
            ditangani secara terpisah melalui Rekonsiliasi.
          </p>

          <div className="integrity-check-grid">
            {report.checks.map((check) => {
              const copy = integrityCheckCopy(check);

              return (
                <article className="integrity-check-card" key={check.id}>
                  <div className="integrity-check-heading">
                    <StatusPill
                      tone={check.status === "PASS" ? "success" : "danger"}
                    >
                      {proofStatusLabel(check.status)}
                    </StatusPill>
                  </div>
                  <h3>{copy.title}</h3>
                  <p>{copy.summary}</p>
                  <div className="integrity-check-summary">
                    <span>Temuan</span>
                    <strong>{formatQuantity(check.issue_count)}</strong>
                    <span>Prioritas</span>
                    <strong>{integritySeverityLabel(check.severity)}</strong>
                  </div>
                  <TechnicalDetails
                    items={[
                      { label: "ID kontrol", value: check.id },
                      { label: "Status sistem", value: check.status },
                      { label: "Tingkat sistem", value: check.severity },
                      { label: "Pesan sistem", value: check.summary },
                    ]}
                  />
                </article>
              );
            })}
          </div>
        </Panel>

        <Accordion className="rounded-xl bg-card px-4 ring-1 ring-foreground/10">
          <AccordionItem id="integrity-protection">
            <AccordionTrigger>
              <div className="grid gap-1">
                <strong>Pemeriksaan perlindungan lanjutan</strong>
                <span className="font-normal text-muted-foreground">
                Opsional. Gunakan saat Anda perlu memastikan transaksi yang
                tidak valid tetap ditolak tanpa menyentuh data operasional.
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <IntegrityChallengeForm />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Accordion className="rounded-xl bg-card px-4 ring-1 ring-foreground/10">
          <AccordionItem id="demo-maintenance">
            <AccordionTrigger>
              <div className="grid gap-1">
                <strong>Pemeliharaan data contoh</strong>
                <span className="font-normal text-muted-foreground">
                Hanya tersedia pada mode demo dan tidak digunakan untuk data
                operasional gudang.
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <DemoResetForm status={demoStatus} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  );
}
