import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202607250001_foundation.sql",
  import.meta.url,
);
const inventoryMigrationUrl = new URL(
  "../supabase/migrations/202607250003_inventory_core.sql",
  import.meta.url,
);
const marketplaceMigrationUrl = new URL(
  "../supabase/migrations/202607260001_marketplace_core.sql",
  import.meta.url,
);
const reservationPreviewMigrationUrl = new URL(
  "../supabase/migrations/202607260003_reservation_aware_fefo_preview.sql",
  import.meta.url,
);
const listingManagementMigrationUrl = new URL(
  "../supabase/migrations/202607270001_product_marketplace_listing_management.sql",
  import.meta.url,
);
const listingFormUrl = new URL(
  "../components/forms/marketplace-listing-form.tsx",
  import.meta.url,
);
const operationsMigrationUrl = new URL(
  "../supabase/migrations/202608020001_return_opname_reconciliation.sql",
  import.meta.url,
);
const returnFormUrl = new URL(
  "../components/forms/return-create-form.tsx",
  import.meta.url,
);
const opnameFormUrl = new URL(
  "../components/forms/opname-workspace-form.tsx",
  import.meta.url,
);
const reconciliationFormUrl = new URL(
  "../components/forms/reconciliation-run-form.tsx",
  import.meta.url,
);
const evidenceMigrationUrl = new URL(
  "../supabase/migrations/202608020003_stock_evidence.sql",
  import.meta.url,
);
const demoReadinessMigrationUrl = new URL(
  "../supabase/migrations/202608020004_demo_readiness.sql",
  import.meta.url,
);
const demoStatusMigrationUrl = new URL(
  "../supabase/migrations/202608020005_demo_status_ready_fix.sql",
  import.meta.url,
);
const challengeLintMigrationUrl = new URL(
  "../supabase/migrations/202608020006_integrity_challenge_lint_templates.sql",
  import.meta.url,
);
const challengeTempPrecedenceMigrationUrl = new URL(
  "../supabase/migrations/202608020007_integrity_challenge_temp_precedence.sql",
  import.meta.url,
);
const integrityChallengeFormUrl = new URL(
  "../components/forms/integrity-challenge-form.tsx",
  import.meta.url,
);
const demoResetFormUrl = new URL(
  "../components/forms/demo-reset-form.tsx",
  import.meta.url,
);
const demoResetRouteUrl = new URL(
  "../app/api/demo/reset/route.ts",
  import.meta.url,
);
const explainBalancePageUrl = new URL(
  "../app/(app)/products/[id]/explain/page.tsx",
  import.meta.url,
);
const integrityPageUrl = new URL(
  "../app/(app)/integrity/page.tsx",
  import.meta.url,
);
const dashboardPageUrl = new URL(
  "../app/(app)/dashboard/page.tsx",
  import.meta.url,
);
const loginPageUrl = new URL("../app/login/page.tsx", import.meta.url);
const demoConfigUrl = new URL("../lib/demo.ts", import.meta.url);
const domainUrl = new URL("../lib/domain/stock.ts", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

const [
  migration,
  inventoryMigration,
  marketplaceMigration,
  reservationPreviewMigration,
  listingManagementMigration,
  listingFormSource,
  operationsMigration,
  returnFormSource,
  opnameFormSource,
  reconciliationFormSource,
  evidenceMigration,
  demoReadinessMigration,
  demoStatusMigration,
  challengeLintMigration,
  challengeTempPrecedenceMigration,
  integrityChallengeFormSource,
  demoResetFormSource,
  demoResetRouteSource,
  explainBalancePageSource,
  integrityPageSource,
  dashboardPageSource,
  loginPageSource,
  demoConfigSource,
  domainSource,
  packageSource,
] =
  await Promise.all([
  readFile(migrationUrl, "utf8"),
  readFile(inventoryMigrationUrl, "utf8"),
  readFile(marketplaceMigrationUrl, "utf8"),
  readFile(reservationPreviewMigrationUrl, "utf8"),
  readFile(listingManagementMigrationUrl, "utf8"),
  readFile(listingFormUrl, "utf8"),
  readFile(operationsMigrationUrl, "utf8"),
  readFile(returnFormUrl, "utf8"),
  readFile(opnameFormUrl, "utf8"),
  readFile(reconciliationFormUrl, "utf8"),
  readFile(evidenceMigrationUrl, "utf8"),
  readFile(demoReadinessMigrationUrl, "utf8"),
  readFile(demoStatusMigrationUrl, "utf8"),
  readFile(challengeLintMigrationUrl, "utf8"),
  readFile(challengeTempPrecedenceMigrationUrl, "utf8"),
  readFile(integrityChallengeFormUrl, "utf8"),
  readFile(demoResetFormUrl, "utf8"),
  readFile(demoResetRouteUrl, "utf8"),
  readFile(explainBalancePageUrl, "utf8"),
  readFile(integrityPageUrl, "utf8"),
  readFile(dashboardPageUrl, "utf8"),
  readFile(loginPageUrl, "utf8"),
  readFile(demoConfigUrl, "utf8"),
  readFile(domainUrl, "utf8"),
  readFile(packageUrl, "utf8"),
  ]);

test("ledger is protected as an append-only source of truth", () => {
  assert.match(migration, /before update or delete on public\.stock_ledger/i);
  assert.match(migration, /STOCK_LEDGER_IS_APPEND_ONLY/);
  assert.match(
    migration,
    /revoke all on table public\.stock_ledger from anon, authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete).*stock_ledger.*authenticated/i,
  );
});

test("ledger insert and balance projection share a database transaction", () => {
  assert.match(
    migration,
    /after insert on public\.stock_ledger[\s\S]*project_stock_ledger_insert\(\)/i,
  );
  assert.match(
    migration,
    /on_hand_qty = public\.stock_balances\.on_hand_qty \+ excluded\.on_hand_qty/i,
  );
  assert.match(migration, /INSUFFICIENT_STOCK/);
});

test("opening balance command binds idempotency key to request hash", () => {
  assert.match(
    migration,
    /create or replace function public\.record_opening_balance/i,
  );
  assert.match(migration, /on conflict \(idempotency_key\) do nothing/i);
  assert.match(migration, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /DUPLICATE/);
});

test("projection is independently verifiable and rebuildable", () => {
  assert.match(
    migration,
    /create or replace function public\.verify_stock_projection/i,
  );
  assert.match(
    migration,
    /create or replace function public\.rebuild_stock_balances/i,
  );
  assert.match(migration, /lock table public\.stock_ledger in share mode/i);
});

test("domain enums stay aligned with the database contract", () => {
  const expectedReasons = [
    "OPENING_BALANCE",
    "PRODUCTION_RECEIPT",
    "ONLINE_SALE",
    "OFFLINE_SALE",
    "BONUS",
    "PROMO",
    "SAMPLE",
    "DAMAGED",
    "EXPIRED",
    "SELLABLE_RETURN",
    "CANCELLATION_REVERSAL",
    "ENTRY_CORRECTION",
    "OPNAME_ADJUSTMENT",
  ];

  for (const reason of expectedReasons) {
    assert.match(migration, new RegExp(`'${reason}'`));
    assert.match(domainSource, new RegExp(`"${reason}"`));
  }
});

test("runtime is Next.js, TypeScript, and Supabase", () => {
  const packageJson = JSON.parse(packageSource);

  assert.ok(packageJson.dependencies.next);
  assert.ok(packageJson.dependencies["@supabase/ssr"]);
  assert.ok(packageJson.dependencies["@supabase/supabase-js"]);
  assert.equal(packageJson.devDependencies.typescript, "5.9.3");
  assert.ok(packageJson.scripts.typecheck);
});

test("inventory core commands remain inside database transaction boundaries", () => {
  assert.match(
    inventoryMigration,
    /create or replace function public\.receive_goods/i,
  );
  assert.match(
    inventoryMigration,
    /create or replace function public\.post_manual_outbound/i,
  );
  assert.match(
    inventoryMigration,
    /for update of balance[\s\S]*INSUFFICIENT_STOCK/i,
  );
  assert.match(
    inventoryMigration,
    /order by batch\.expiry_date, batch\.created_at, batch\.id/i,
  );
  assert.match(
    inventoryMigration,
    /create or replace function public\.correct_movement/i,
  );
  assert.match(inventoryMigration, /MOVEMENT_ALREADY_REVERSED/);
});

test("movement receipts expose stable allocation evidence", () => {
  assert.match(inventoryMigration, /balance_before/);
  assert.match(inventoryMigration, /balance_after/);
  assert.match(inventoryMigration, /product_sku/);
  assert.match(inventoryMigration, /batch_code/);
  assert.match(inventoryMigration, /sequence_no/);
});

test("marketplace events are canonical, auditable, and idempotent", () => {
  assert.match(
    marketplaceMigration,
    /create table public\.marketplace_events/i,
  );
  assert.match(
    marketplaceMigration,
    /unique \(source, external_event_id\)/i,
  );
  assert.match(
    marketplaceMigration,
    /create table public\.marketplace_event_attempts/i,
  );
  assert.match(marketplaceMigration, /EVENT_ID_REUSED/);
  assert.match(marketplaceMigration, /OUT_OF_ORDER_SHIPMENT_EVENT/);
  assert.match(
    marketplaceMigration,
    /create or replace function public\.ingest_marketplace_event_batch/i,
  );
});

test("marketplace stock lifecycle separates reservation from shipment", () => {
  assert.match(
    marketplaceMigration,
    /create table public\.product_reservations/i,
  );
  assert.match(
    marketplaceMigration,
    /create or replace function public\.ship_order/i,
  );
  assert.match(
    marketplaceMigration,
    /when p_channel = 'SHOPEE' then 'SHIPPED'/i,
  );
  assert.match(
    marketplaceMigration,
    /else 'IN_TRANSIT'::public\.marketplace_order_status/i,
  );
  assert.match(
    marketplaceMigration,
    /for update of balance[\s\S]*FEFO_ALLOCATION_INCOMPLETE/i,
  );
});

test("bundle, promo, and cancellation use frozen physical snapshots", () => {
  assert.match(
    marketplaceMigration,
    /create table public\.bundle_recipe_versions/i,
  );
  assert.match(
    marketplaceMigration,
    /create table public\.order_item_components/i,
  );
  assert.match(
    marketplaceMigration,
    /'recipe_version_id'[\s\S]*'recipe_version'[\s\S]*'bundle_sku'/i,
  );
  assert.match(
    marketplaceMigration,
    /'promo_rule_id'[\s\S]*'promo_name'[\s\S]*'free_product_sku'/i,
  );
  assert.match(
    marketplaceMigration,
    /create or replace function public\.cancel_order_items/i,
  );
  assert.match(marketplaceMigration, /reverses_movement_id/);
  assert.match(marketplaceMigration, /CANCELLATION_REVERSAL/);
});

test("manual FEFO preview reports on-hand, reserved, and available stock", () => {
  assert.match(
    reservationPreviewMigration,
    /create or replace function public\.preview_fefo_allocation/i,
  );
  assert.match(
    reservationPreviewMigration,
    /from public\.product_reservations/i,
  );
  assert.match(reservationPreviewMigration, /'on_hand_qty'/);
  assert.match(reservationPreviewMigration, /'reserved_qty'/);
  assert.match(reservationPreviewMigration, /'available_qty'/);
});

test("product marketplace listings are admin-managed and simulator-ready", () => {
  assert.match(
    listingManagementMigration,
    /create or replace function public\.save_product_marketplace_listing/i,
  );
  assert.match(listingManagementMigration, /perform public\.assert_admin\(\)/i);
  assert.match(
    listingManagementMigration,
    /p_channel not in \('SHOPEE', 'TIKTOK'\)/i,
  );
  assert.match(
    listingManagementMigration,
    /INACTIVE_PRODUCT_CANNOT_HAVE_ACTIVE_LISTING/i,
  );
  assert.match(
    listingManagementMigration,
    /MARKETPLACE_LISTING_SKU_ALREADY_EXISTS/i,
  );
  assert.match(
    listingManagementMigration,
    /grant execute on function public\.save_product_marketplace_listing[\s\S]*to authenticated/i,
  );
});

test("product detail listing flow uses explicit preview and internal SKU shortcut", () => {
  assert.match(
    listingFormSource,
    /\/api\/commands\/marketplace\/listing/,
  );
  assert.match(listingFormSource, /setListingSku\(productSku\)/);
  assert.match(listingFormSource, /if \(!showPreview\)/);
  assert.match(listingFormSource, /Konfirmasi marketplace listing/);
  assert.match(
    listingFormSource,
    /Listing aktif langsung tersedia saat mencatat order marketplace/,
  );
});

test("return commands enforce shipped quantity and condition-specific stock effects", () => {
  assert.match(
    operationsMigration,
    /create or replace function public\.create_return/i,
  );
  assert.match(operationsMigration, /RETURN_QUANTITY_EXCEEDS_SHIPPED/);
  assert.match(
    operationsMigration,
    /greatest\(component\.shipped_qty - component\.cancelled_qty, 0\)/i,
  );
  assert.match(
    operationsMigration,
    /create or replace function public\.inspect_return_item/i,
  );
  assert.match(operationsMigration, /p_condition = 'SELLABLE'/i);
  assert.match(operationsMigration, /'SELLABLE_RETURN'/i);
  assert.match(
    operationsMigration,
    /p_condition not in \('DAMAGED', 'LOST'\)/i,
  );
  assert.match(operationsMigration, /interval '40 days'/i);
});

test("opname snapshots counts and finalizes ledger adjustment exactly once", () => {
  assert.match(
    operationsMigration,
    /create or replace function public\.start_opname_session/i,
  );
  assert.match(
    operationsMigration,
    /coalesce\(balance\.on_hand_qty, 0\)/i,
  );
  assert.match(
    operationsMigration,
    /create or replace function public\.finalize_opname_session/i,
  );
  assert.match(operationsMigration, /OPNAME_SNAPSHOT_STALE/);
  assert.match(operationsMigration, /'OPNAME_ADJUSTMENT'/i);
  assert.match(
    operationsMigration,
    /verification_status = 'VERIFIED'/i,
  );
  assert.match(operationsMigration, /OPNAME_SESSION_ALREADY_FINALIZED/);
});

test("reconciliation and notification UI share deterministic database sources", () => {
  assert.match(
    operationsMigration,
    /create or replace function public\.run_daily_reconciliation/i,
  );
  assert.match(operationsMigration, /PROJECTION_DRIFT/);
  assert.match(operationsMigration, /ORDER_LEDGER_MISMATCH/);
  assert.match(operationsMigration, /ORPHAN_MOVEMENT/);
  assert.match(
    operationsMigration,
    /create or replace view public\.notification_feed[\s\S]*security_invoker = true/i,
  );
  assert.match(returnFormSource, /if \(!showPreview\)/);
  assert.match(returnFormSource, /\/api\/commands\/returns\/create/);
  assert.match(opnameFormSource, /Konfirmasi penyelesaian opname/);
  assert.match(opnameFormSource, /\/api\/commands\/opname\/finalize/);
  assert.match(reconciliationFormSource, /Tinjau pemeriksaan/);
});

test("why-this-balance reconciles deterministic categories to projection", () => {
  assert.match(
    evidenceMigration,
    /create or replace function public\.explain_product_balance/i,
  );
  assert.match(evidenceMigration, /'OPENING_BALANCE' then 'OPENING'/i);
  assert.match(
    evidenceMigration,
    /'ONLINE_SALE', 'CANCELLATION_REVERSAL'/i,
  );
  assert.match(
    evidenceMigration,
    /'breakdown_total', v_ledger_qty/i,
  );
  assert.match(
    evidenceMigration,
    /'matches_projection', v_projection_qty = v_ledger_qty/i,
  );
  assert.match(explainBalancePageSource, /Mengapa stoknya segini\?/);
  assert.match(explainBalancePageSource, /Kontributor saldo/);
  assert.match(explainBalancePageSource, /\/ledger\/\$\{movement\.command_id\}/);
});

test("integrity center checks live invariants instead of stored badges", () => {
  assert.match(
    evidenceMigration,
    /create or replace function public\.get_integrity_report/i,
  );
  assert.match(evidenceMigration, /projection_equals_ledger/);
  assert.match(evidenceMigration, /no_negative_batch/);
  assert.match(evidenceMigration, /no_duplicate_applied_event/);
  assert.match(evidenceMigration, /no_orphan_movement/);
  assert.match(evidenceMigration, /valid_order_status/);
  assert.match(evidenceMigration, /no_over_return/);
  assert.match(evidenceMigration, /movement_groups_reconciled/);
  assert.match(evidenceMigration, /append_only_guard_active/);
  assert.match(integrityPageSource, /Riwayat dan saldo stok konsisten/);
  assert.match(integrityPageSource, /className="panel disclosure-panel"/);
  assert.match(
    integrityPageSource,
    /perbedaan operasional tetap perlu ditangani/,
  );
});

test("integrity challenge is isolated and fingerprints the main dataset", () => {
  assert.match(
    evidenceMigration,
    /create or replace function public\.run_integrity_challenge/i,
  );
  assert.match(evidenceMigration, /DEMO_MODE_REQUIRED/);
  assert.match(evidenceMigration, /create temporary table/i);
  assert.match(evidenceMigration, /TEMPORARY_FIXTURE/);
  assert.match(evidenceMigration, /main_dataset_unchanged/);
  assert.match(evidenceMigration, /ledger_mutation_rejection/);
  assert.match(
    integrityChallengeFormSource,
    /\/api\/integrity\/challenge/,
  );
  assert.match(
    integrityChallengeFormSource,
    /Dataset utama/,
  );
});

test("dashboard prioritizes current stock conditions and actionable work", () => {
  assert.match(dashboardPageSource, /Perlu ditindaklanjuti/);
  assert.match(dashboardPageSource, /Pergerakan terakhir/);
  assert.match(dashboardPageSource, /<span>SKU aktif<\/span>/);
  assert.match(dashboardPageSource, /<span>Kedaluwarsa ≤ 90 hari<\/span>/);
  assert.match(dashboardPageSource, /<span>Saldo awal belum diverifikasi<\/span>/);
  assert.doesNotMatch(dashboardPageSource, /guided-journey/);
  assert.doesNotMatch(dashboardPageSource, /controlFlow/);
});

test("sample credentials are server-configured and visible on fresh login", () => {
  assert.match(demoConfigSource, /import "server-only"/);
  assert.match(demoConfigSource, /process\.env\.DEMO_LOGIN_EMAIL/);
  assert.match(demoConfigSource, /process\.env\.DEMO_LOGIN_PASSWORD/);
  assert.doesNotMatch(demoConfigSource, /NEXT_PUBLIC_DEMO/);
  assert.match(loginPageSource, /Akun contoh tersedia/);
  assert.match(loginPageSource, /Form sudah terisi/);
  assert.match(loginPageSource, /demoEmail=\{demoCredentials\?\.email\}/);
  assert.match(loginPageSource, /demoPassword=\{demoCredentials\?\.password\}/);
});

test("demo reset is admin-only, demo-only, confirmed, and idempotent", () => {
  assert.match(
    demoReadinessMigration,
    /create or replace function public\.reset_demo_dataset/i,
  );
  assert.match(demoReadinessMigration, /perform public\.assert_admin\(\)/i);
  assert.match(demoReadinessMigration, /DEMO_MODE_REQUIRED/);
  assert.match(demoReadinessMigration, /DEMO_RESET_CONFIRMATION_REQUIRED/);
  assert.match(
    demoReadinessMigration,
    /pg_advisory_xact_lock\(hashtext\('stokledger:demo-reset'\)\)/i,
  );
  assert.match(demoReadinessMigration, /truncate table[\s\S]*restart identity cascade/i);
  assert.match(demoReadinessMigration, /demo_generation = demo_generation \+ 1/i);
  assert.match(demoReadinessMigration, /stokledger-demo-v1/);
  assert.match(demoStatusMigration, /v_settings\.demo_generation > 0/i);
  assert.match(
    demoStatusMigration,
    /id = '61000000-0000-4000-8000-000000000001'/i,
  );
  assert.match(
    challengeLintMigration,
    /create schema if not exists integrity_templates/i,
  );
  assert.match(
    challengeLintMigration,
    /INTEGRITY_TEMPLATE_IS_NOT_RUNTIME_STORAGE/i,
  );
  assert.match(
    challengeLintMigration,
    /alter function public\.run_integrity_challenge\(\)[\s\S]*integrity_templates/i,
  );
  assert.match(
    challengeTempPrecedenceMigration,
    /set search_path = pg_temp, public, integrity_templates/i,
  );
  assert.match(
    demoReadinessMigration,
    /grant execute on function public\.reset_demo_dataset\(text\) to authenticated/i,
  );
});

test("demo reset UI requires a destructive preview and typed confirmation", () => {
  assert.match(demoResetFormSource, /Atur ulang data contoh/);
  assert.match(demoResetFormSource, /Perubahan permanen/);
  assert.match(demoResetFormSource, /RESET_CONFIRMATION = "RESET DEMO"/);
  assert.match(demoResetFormSource, /Konfirmasi pengaturan ulang/);
  assert.match(demoResetFormSource, /\/api\/demo\/reset/);
  assert.match(demoResetRouteSource, /handleAuthenticatedPost/);
  assert.match(demoResetRouteSource, /requiredString/);
  assert.match(demoResetRouteSource, /reset_demo_dataset/);
});
