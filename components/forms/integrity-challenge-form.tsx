"use client";

import { toast } from "sonner";
import { useState } from "react";
import { postJson } from "@/lib/client/api";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { TechnicalDetails } from "@/components/technical-details";
import type { IntegrityChallengeResult } from "@/lib/domain/proof";
import {
  integrityChallengeCopy,
  integrityEvidenceLabel,
  proofStatusLabel,
} from "@/lib/domain/proof";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export function IntegrityChallengeForm() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntegrityChallengeResult | null>(null);

  async function runChallenge() {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const challenge = await postJson<IntegrityChallengeResult>(
        "/api/integrity/challenge",
        {},
      );
      setResult(challenge);
      const passedCount = challenge.scenarios.filter((s) => s.status === "PASS").length;
      toast.success("Uji perlindungan integritas selesai.", {
        description: `${passedCount}/${challenge.scenarios.length} skenario uji perlindungan valid.`,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Uji perlindungan belum dapat dijalankan.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="integrity-challenge">
      <div className="challenge-intro">
        <div>
          <h3>Pastikan transaksi yang tidak valid tetap ditolak</h3>
          <p>
            Sistem membuat data sementara, mencoba transaksi yang tidak valid,
            lalu memastikan data operasional utama tetap aman. Pengujian ini
            tidak menambah riwayat stok gudang.
          </p>
        </div>
        <Button
          className="h-11 px-5"
          isDisabled={isRunning}
          onClick={runChallenge}
          type="button"
        >
          <ButtonContent isLoading={isRunning} loadingLabel="Memeriksa perlindungan stok…">
            Jalankan pemeriksaan
          </ButtonContent>
        </Button>
      </div>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {result ? (
        <div className="challenge-result" aria-live="polite">
          <div className="challenge-result-heading">
            <div>
              <span
                className={`proof-state proof-state-${result.overall_status.toLowerCase()}`}
              >
                {proofStatusLabel(result.overall_status)}
              </span>
              <strong>
                {result.scenarios.filter((scenario) => scenario.status === "PASS").length}
                /{result.scenarios.length} pemeriksaan berhasil
              </strong>
            </div>
            <div>
              <span>Dataset utama</span>
              <strong>
                {result.main_dataset_unchanged ? "Tidak berubah" : "Berubah"}
              </strong>
            </div>
            <div>
              <span>Pemisahan data</span>
              <strong>Data uji sementara</strong>
            </div>
          </div>

          <div className="challenge-grid">
            {result.scenarios.map((scenario) => {
              const copy = integrityChallengeCopy(scenario);

              return (
                <article className="challenge-card" key={scenario.id}>
                  <div>
                    <span
                      className={`proof-state proof-state-${scenario.status.toLowerCase()}`}
                    >
                      {proofStatusLabel(scenario.status)}
                    </span>
                  </div>
                  <h4>{copy.title}</h4>
                  <p>{copy.summary}</p>
                  <TechnicalDetails
                    items={[
                      { label: "ID pemeriksaan", value: scenario.id },
                      { label: "Status sistem", value: scenario.status },
                      { label: "Pesan sistem", value: scenario.summary },
                      ...Object.entries(scenario.evidence).map(([key, value]) => ({
                        label: integrityEvidenceLabel(key),
                        value:
                          typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value),
                      })),
                    ]}
                  />
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="challenge-empty">
          <strong>Pengujian belum dijalankan pada sesi ini.</strong>
          <p>
            Data uji dibuat ulang setiap kali tombol dijalankan dan tidak masuk
            ke riwayat operasional gudang.
          </p>
        </div>
      )}
    </div>
  );
}
