# StokLedger Web

Next.js + TypeScript + Supabase implementation untuk submission
`@risviantoe`.

## Prerequisites

- Node.js `>=22.13.0`
- Supabase project atau Supabase CLI untuk local stack

## Local Setup

1. Install dependency:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env.local`, kemudian isi:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   NEXT_PUBLIC_APP_URL
   ```

3. Jalankan migration pada database kosong:

   ```bash
   supabase db reset
   ```

4. Buat satu user email/password melalui Supabase Auth. Migration otomatis
   membuat profile dengan role `ADMIN`. Public signup harus tetap dimatikan.

5. Untuk environment demo/submission, bentuk fixture deterministik setelah
   user Admin tersedia:

   ```bash
   npx supabase db query --linked --file supabase/demo_seed.sql
   ```

6. Jalankan web:

   ```bash
   npm run dev
   ```

## Quality Gates

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx supabase db query --linked --file supabase/tests/001_foundation_invariants.sql
npx supabase db query --linked --file supabase/tests/002_inventory_core.sql
npx supabase db query --linked --file supabase/tests/003_marketplace_core.sql
npx supabase db query --linked --file supabase/tests/004_return_opname_reconciliation.sql
npx supabase db query --linked --file supabase/tests/005_stock_evidence.sql
npx supabase db query --linked --file supabase/tests/006_demo_readiness.sql
```

Build dapat selesai tanpa env Supabase. Pada kondisi itu aplikasi menampilkan
mode setup secara jujur dan tidak merender data palsu.

Untuk local Supabase dengan Docker aktif, kedua SQL test juga dapat dijalankan
melalui test runner CLI.

## Database Foundation

Migration `202607250001_foundation.sql` menyediakan:

- enum channel/reason yang fixed;
- one-role Admin profile dan RLS;
- catalog produk/batch;
- `business_commands` dan request hash;
- `movement_groups`;
- append-only `stock_ledger`;
- O(1) `stock_balances` projection;
- trigger atomic projection dan negative-stock guard;
- opening balance berstatus `UNVERIFIED`;
- idempotent RPC `record_opening_balance`;
- projection verification dan controlled rebuild.

Catalog seed hanya membuat produk dan batch. Stock seed tidak di-insert langsung
karena seluruh stock movement harus melewati command layer.

## Inventory Core

Milestone 2 menambahkan:

- CRUD produk melalui Admin RPC dan deactivation tanpa hard delete;
- pembuatan batch production;
- barang masuk idempotent;
- preview FEFO read-only;
- manual outbound FEFO dengan row locking;
- correction sebagai full reversal;
- Movement Receipt dengan saldo historis before/after;
- dashboard, products, inbound, manual outbound, ledger, dan receipt routes.

## Marketplace

Milestone 3 menambahkan:

- canonical marketplace event contract untuk simulator dan CSV import;
- riwayat event marketplace dengan status received, applied, duplicate, dan rejected;
- order Shopee/TikTok multi-item;
- reservation yang mengurangi available tanpa mengubah on-hand;
- Shopee outbound pada `SHIPPED` dan TikTok pada `IN_TRANSIT`;
- FEFO atomic untuk seluruh komponen order;
- bundle recipe berversi dan immutable order snapshot;
- promo buy-X-get-Y dengan snapshot dan atomic free-item allocation;
- cancellation sebelum shipment, setelah shipment, dan partial per line;
- event receipt yang menautkan event, command, movement group, dan ledger.
- listing Shopee/TikTok per produk dengan SKU marketplace yang dapat berbeda
  dari SKU internal;
- shortcut membuat listing memakai SKU internal dari halaman detail produk;
- sinkronisasi aman: listing aktif muncul di simulator dan otomatis nonaktif
  ketika produk dinonaktifkan.

CSV import memakai preview dan laporan per baris, lalu memanggil handler
database yang sama dengan simulator.

Untuk menghubungkan produk baru ke simulator, buka detail produk lalu gunakan
panel **Listing Shopee & TikTok Shop**. Buat listing aktif untuk channel yang
diinginkan; tombol shortcut otomatis mengisi SKU internal produk.

## Return dan Reconciliation

Milestone 4 menambahkan:

- partial return berdasarkan physical component snapshot;
- over-return guard lintas beberapa return;
- inspeksi sellable/damaged/lost;
- batch `RETURN-*` dan movement `SELLABLE_RETURN`;
- TikTok claim deadline 40 hari dan reminder in-app;
- opname draft, snapshot per batch, dan atomic finalize;
- opening balance verification melalui opname pertama;
- daily reconciliation dan anomaly worklist;
- shared notification feed untuk dashboard dan halaman notifikasi.

Route operator tersedia di `/returns`, `/opname`, `/reconciliation`, dan
`/notifications`.

## Bukti Stok

Milestone 5 menambahkan:

- `/products/:id/explain` untuk breakdown saldo deterministik;
- drill-down kategori sampai movement, batch, before/after, dan receipt;
- `/integrity` dengan delapan invariant live;
- Integrity Challenge delapan skenario pada temporary fixture;
- fingerprint dataset utama sebelum dan sesudah challenge;
- panduan alur kerja operasional pada dashboard;
- optional credential demo pada login.

Untuk submission, isi `DEMO_LOGIN_EMAIL` dan `DEMO_LOGIN_PASSWORD` pada
server. Keduanya sengaja bukan `NEXT_PUBLIC_*`; halaman server hanya
menampilkan credential jika kedua nilai tersedia.

## Demo Readiness

Milestone 6A menyediakan fixture `stokledger-demo-v1` dengan enam produk,
sembilan batch, order reserved dan shipped, FEFO split, duplicate event,
bundle snapshot, promo, partial return, correction, completed opname, dan
anomaly terbuka.

## End-to-end Testing

Playwright menyediakan tiga lapis pengujian browser:

- public auth untuk login dan redirect halaman terproteksi;
- authenticated smoke untuk seluruh halaman operasional dan navigasi mobile;
- marketplace lifecycle untuk reset fixture demo, membuat order, dan memastikan
  event identik menjadi duplicate tanpa efek stok kedua.

Pasang browser Chromium satu kali:

```bash
npx playwright install chromium
```

Tambahkan credential Admin khusus E2E ke `.env.e2e.local`:

```text
E2E_ADMIN_EMAIL=admin@stokledger.demo
E2E_ADMIN_PASSWORD=replace-with-e2e-password
```

Smoke test publik selalu aman dijalankan:

```bash
npm run test:e2e:public
```

Seluruh smoke test terautentikasi dijalankan dengan:

```bash
npm run test:e2e
```

Test yang mereset fixture dan mengubah data sengaja dilewati secara default.
Aktifkan hanya terhadap server lokal dan database demo:

```powershell
$env:E2E_MUTATION_MODE="demo"
npm run test:e2e
```

Reset tersedia di `/integrity` dan hanya dapat dijalankan jika:

- caller mempunyai session Admin;
- database berada dalam `demo_mode`;
- preview sudah dibuka;
- frasa `RESET DEMO` diketik persis.

Reset mempertahankan profiles dan system settings. Untuk bootstrap melalui
CLI, gunakan `supabase/demo_seed.sql` setelah membuat user Admin. Jangan
menjalankan seed ini pada database operasional non-demo.

## Important Boundaries

- Browser tidak pernah menulis ledger.
- Satu aksi bisnis memanggil satu transactional RPC.
- Service-role key tidak boleh berada di client bundle.
- Ledger adalah source of truth; projection harus rebuildable.
- Tidak ada harga, multi-warehouse, atau integrasi marketplace production.

Lihat `../docs/ARCHITECTURE.md`, `../docs/DECISIONS.md`, dan
`../docs/ACCEPTANCE_TESTS.md` untuk kontrak lengkap.
