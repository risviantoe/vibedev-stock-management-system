import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Boxes } from "lucide-react";
import { getDemoLoginCredentials } from "@/lib/demo";
import { getPublicSupabaseConfig } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default function LoginPage() {
  const configured = Boolean(getPublicSupabaseConfig());
  const demoCredentials = getDemoLoginCredentials();

  return (
    <main className="login-shell">
      <section className="login-story">
        <Link
          className="inline-flex w-fit items-center gap-3 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint)]"
          href="/"
        >
          <span
            className="grid size-11 place-items-center rounded-xl border border-white/20 bg-[var(--mint)] text-[var(--forest)]"
            aria-hidden="true"
          >
            <Boxes size={21} strokeWidth={2.4} />
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-white">
              StokLedger
            </span>
            <span className="mt-0.5 block text-[0.6875rem] font-semibold tracking-[0.1em] text-white/65 uppercase">
              Kontrol Persediaan
            </span>
          </span>
        </Link>

        <div className="story-copy">
          <h1>Kelola persediaan sampai ke tingkat batch.</h1>
          <p>
            Pantau barang masuk, alokasi order, pengiriman, retur, dan stok
            opname dalam satu riwayat yang mudah ditelusuri.
          </p>
        </div>

        <div className="story-stats">
          <div>
            <strong>0</strong>
            <span>perubahan stok sebagian</span>
          </div>
          <div>
            <strong>O(1)</strong>
            <span>akses saldo</span>
          </div>
          <div>
            <strong>100%</strong>
            <span>dapat ditelusuri</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div>
            <h2>Masuk ke StokLedger</h2>
            <p className="login-intro">
              Gunakan akun Admin Supabase yang telah dikonfigurasi untuk
              workspace ini.
            </p>
          </div>

          {configured ? (
            <>
              {demoCredentials ? (
                <aside className="demo-credentials" aria-label="Credential demo">
                  <div>
                    <span>Akun contoh tersedia</span>
                    <strong>Informasi masuk</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Email</dt>
                      <dd>{demoCredentials.email}</dd>
                    </div>
                    <div>
                      <dt>Password</dt>
                      <dd>{demoCredentials.password}</dd>
                    </div>
                  </dl>
                  <p>Form sudah terisi. Klik masuk untuk membuka data contoh.</p>
                </aside>
              ) : null}
              <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
                <LoginForm
                  demoEmail={demoCredentials?.email}
                  demoPassword={demoCredentials?.password}
                />
              </Suspense>
            </>
          ) : (
            <div className="config-callout" role="status">
              <strong>Supabase belum dikonfigurasi</strong>
              <p>
                Isi environment dari <code>.env.example</code>. Halaman ini
                sengaja tidak menampilkan form palsu sebelum backend tersedia.
              </p>
              <LinkButton className="h-11 w-full px-5" href="/">
                Kembali ke fondasi
              </LinkButton>
            </div>
          )}

          <p className="security-note">
            Sesi diverifikasi server-side. Service-role key tidak pernah
            dikirimkan ke browser.
          </p>
        </div>
      </section>
    </main>
  );
}
