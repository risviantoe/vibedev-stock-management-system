"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageMinus,
  PackagePlus,
  PackageSearch,
  RotateCcw,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  Store,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { I18nProvider } from "react-aria-components";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    id: "ringkasan",
    label: "Ringkasan",
    items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Tugas Hari Ini" }],
  },
  {
    id: "operasional",
    label: "Operasional",
    items: [
      { href: "/products", icon: PackageSearch, label: "Produk & Batch" },
      { href: "/inbound", icon: PackagePlus, label: "Barang Masuk" },
      { href: "/manual", icon: PackageMinus, label: "Barang Keluar" },
      { href: "/marketplace", icon: Store, label: "Marketplace" },
      { href: "/promos", icon: Tags, label: "Bundle & Promo" },
      { href: "/returns", icon: RotateCcw, label: "Retur Barang" },
    ],
  },
  {
    id: "pengawasan",
    label: "Pengawasan",
    items: [
      { href: "/opname", icon: ClipboardCheck, label: "Stok Opname" },
      { href: "/reconciliation", icon: ScanSearch, label: "Rekonsiliasi" },
      { href: "/integrity", icon: ShieldCheck, label: "Pemeriksaan Stok" },
      { href: "/notifications", icon: Bell, label: "Notifikasi" },
      { href: "/ledger", icon: ScrollText, label: "Riwayat Stok" },
    ],
  },
];

function isNavigationItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function NavigationLink({
  item,
  onNavigate,
  pathname,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const active = isNavigationItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/7 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint)]",
        active && "bg-white/10 text-white",
      )}
      href={item.href}
      onClick={onNavigate}
    >
      <span
        className={cn(
          "grid size-7 place-items-center rounded-lg border border-white/15 text-white/70",
          active &&
            "border-[color:rgba(198,241,109,0.28)] bg-[color:rgba(198,241,109,0.12)] text-[var(--mint)]",
        )}
        aria-hidden="true"
      >
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
      {active ? (
        <span
          className="size-2 rounded-full bg-[var(--mint)] shadow-[0_0_0_0.25rem_rgba(198,241,109,0.12)]"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}

function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      className="inline-flex w-fit items-center gap-3 rounded-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint)]"
      href="/dashboard"
    >
      <span
        className="grid size-11 place-items-center rounded-xl border border-white/20 bg-[var(--mint)] text-[var(--forest)]"
        aria-hidden="true"
      >
        <Boxes size={21} strokeWidth={2.4} />
      </span>
      <span className="block">
        <span
          className={cn(
            "block text-base font-bold tracking-tight",
            onDark ? "text-white" : "text-foreground",
          )}
        >
          Celo Beaute
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[0.6875rem] font-semibold tracking-[0.1em] uppercase",
            onDark ? "text-white/65" : "text-muted-foreground",
          )}
        >
          Kontrol Persediaan
        </span>
      </span>
    </Link>
  );
}

function PrimaryNavigation({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav
      className="mt-6 grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 [scrollbar-width:thin]"
      aria-label="Navigasi utama"
    >
      {navigationGroups.map((group) => (
        <div aria-labelledby={`nav-${group.id}`} className="grid gap-1" key={group.id} role="group">
          <p
            className="mb-1 px-3 text-[0.6875rem] font-bold tracking-[0.1em] text-white/45 uppercase"
            id={`nav-${group.id}`}
          >
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavigationLink
              item={item}
              key={item.href}
              onNavigate={onNavigate}
              pathname={pathname}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function Account({ email }: { email: string }) {
  return (
    <div className="mt-auto grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-white/10 pt-4">
      <span
        className="grid size-9 place-items-center rounded-xl bg-[color:rgba(198,241,109,0.13)] text-[0.6875rem] font-bold text-[var(--mint)]"
        aria-hidden="true"
      >
        AD
      </span>
      <span className="min-w-0">
        <strong className="block text-xs font-bold text-white">Admin Gudang</strong>
        <span className="mt-0.5 block truncate text-[0.6875rem] text-white/65">{email}</span>
      </span>
      <form action="/auth/signout" method="post">
        <TooltipTrigger delay={400}>
          <Button
            aria-label="Keluar dari aplikasi"
            className="size-11 border border-white/15 !text-white/70 hover:border-white/30 hover:!bg-white/10 hover:!text-white"
            size="icon-sm"
            type="submit"
            variant="ghost"
          >
            <LogOut
              aria-hidden="true"
              className="size-4 text-white/70 group-hover/button:text-white"
              size={16}
            />
          </Button>
          <Tooltip placement="top">Keluar</Tooltip>
        </TooltipTrigger>
      </form>
    </div>
  );
}

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <I18nProvider locale="id-ID">
      <main className="operational-shell min-h-dvh bg-background font-sans text-foreground [font-variant-numeric:tabular-nums] min-[1051px]:grid min-[1051px]:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col bg-[var(--forest)] px-6 py-8 text-white min-[1051px]:flex">
          <Brand onDark />
          <PrimaryNavigation pathname={pathname} />
          <Account email={email} />
        </aside>

        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl min-[1051px]:hidden">
          <Brand />
          <SheetTrigger isOpen={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
            <Button
              aria-label="Buka menu navigasi"
              className="size-11"
              size="icon"
              variant="outline"
            >
              <Menu aria-hidden="true" size={21} />
            </Button>
            <SheetContent
              className="w-[min(21rem,calc(100vw-2rem))] gap-0 bg-[var(--forest)] p-0 text-white sm:max-w-xs [&_[data-slot=sheet-close]]:text-white [&_[data-slot=sheet-close]]:hover:bg-white/10"
              side="left"
            >
              <SheetHeader className="border-b border-white/10 px-5 py-4">
                <SheetTitle className="text-white">Menu operasional</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
                <PrimaryNavigation
                  onNavigate={() => setMobileNavigationOpen(false)}
                  pathname={pathname}
                />
                <Account email={email} />
              </div>
            </SheetContent>
          </SheetTrigger>
        </header>

        <section className="min-h-dvh min-w-0">{children}</section>
      </main>
    </I18nProvider>
  );
}
