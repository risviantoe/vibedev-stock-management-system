import type { PaginationSearchParams } from "@/lib/pagination";
import { STOCK_REASONS, type StockReason } from "@/lib/domain/stock";

export type ProductRetrieval = {
  search: string;
  status: "ALL" | "ACTIVE" | "INACTIVE";
  expiry: "ALL" | "EXPIRED" | "DAYS_30" | "DAYS_90";
  sort: "SKU_ASC" | "EXPIRY_ASC" | "AVAILABLE_ASC" | "UPDATED_DESC";
};

export type LedgerRetrieval = {
  search: string;
  from: string;
  to: string;
  reason: "ALL" | StockReason;
  channel: "ALL" | "SHOPEE" | "TIKTOK" | "OFFLINE" | "INTERNAL";
  status: "ALL" | "FINAL" | "CORRECTION" | "REVERSED";
  sort: "OCCURRED_DESC" | "OCCURRED_ASC";
};

export type MarketplaceOrderRetrieval = {
  search: string;
  channel: "ALL" | "SHOPEE" | "TIKTOK";
  status:
    | "ALL"
    | "RESERVED"
    | "SHIPPED"
    | "IN_TRANSIT"
    | "PARTIALLY_CANCELLED"
    | "CANCELLED";
  sort: "UPDATED_DESC" | "ORDERED_DESC";
};

export type MarketplaceEventRetrieval = {
  search: string;
  channel: "ALL" | "SHOPEE" | "TIKTOK";
  status: "ALL" | "RECEIVED" | "APPLIED" | "DUPLICATE" | "REJECTED";
  sort: "RECEIVED_DESC" | "RECEIVED_ASC";
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseSearch(value: string | string[] | undefined): string {
  return firstValue(value).trim().slice(0, 160);
}

function parseAllowed<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const candidate = firstValue(value).toUpperCase();
  return allowed.includes(candidate as T) ? (candidate as T) : fallback;
}

function parseDate(value: string | string[] | undefined): string {
  const candidate = firstValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : "";
}

export function parseProductRetrieval(
  params: PaginationSearchParams,
): ProductRetrieval {
  return {
    search: parseSearch(params.q),
    status: parseAllowed(params.status, ["ALL", "ACTIVE", "INACTIVE"], "ACTIVE"),
    expiry: parseAllowed(
      params.expiry,
      ["ALL", "EXPIRED", "DAYS_30", "DAYS_90"],
      "ALL",
    ),
    sort: parseAllowed(
      params.sort,
      ["SKU_ASC", "EXPIRY_ASC", "AVAILABLE_ASC", "UPDATED_DESC"],
      "SKU_ASC",
    ),
  };
}

export function parseLedgerRetrieval(
  params: PaginationSearchParams,
): LedgerRetrieval {
  return {
    search: parseSearch(params.q),
    from: parseDate(params.from),
    to: parseDate(params.to),
    reason: parseAllowed(params.reason, ["ALL", ...STOCK_REASONS], "ALL"),
    channel: parseAllowed(
      params.channel,
      ["ALL", "SHOPEE", "TIKTOK", "OFFLINE", "INTERNAL"],
      "ALL",
    ),
    status: parseAllowed(
      params.status,
      ["ALL", "FINAL", "CORRECTION", "REVERSED"],
      "ALL",
    ),
    sort: parseAllowed(
      params.sort,
      ["OCCURRED_DESC", "OCCURRED_ASC"],
      "OCCURRED_DESC",
    ),
  };
}

export function parseMarketplaceOrderRetrieval(
  params: PaginationSearchParams,
): MarketplaceOrderRetrieval {
  return {
    search: parseSearch(params.orderQ),
    channel: parseAllowed(
      params.orderChannel,
      ["ALL", "SHOPEE", "TIKTOK"],
      "ALL",
    ),
    status: parseAllowed(
      params.orderStatus,
      [
        "ALL",
        "RESERVED",
        "SHIPPED",
        "IN_TRANSIT",
        "PARTIALLY_CANCELLED",
        "CANCELLED",
      ],
      "ALL",
    ),
    sort: parseAllowed(
      params.orderSort,
      ["UPDATED_DESC", "ORDERED_DESC"],
      "UPDATED_DESC",
    ),
  };
}

export function parseMarketplaceEventRetrieval(
  params: PaginationSearchParams,
): MarketplaceEventRetrieval {
  return {
    search: parseSearch(params.eventQ),
    channel: parseAllowed(
      params.eventChannel,
      ["ALL", "SHOPEE", "TIKTOK"],
      "ALL",
    ),
    status: parseAllowed(
      params.eventStatus,
      ["ALL", "RECEIVED", "APPLIED", "DUPLICATE", "REJECTED"],
      "ALL",
    ),
    sort: parseAllowed(
      params.eventSort,
      ["RECEIVED_DESC", "RECEIVED_ASC"],
      "RECEIVED_DESC",
    ),
  };
}

export function optionalQueryValue(
  value: string,
  defaultValue = "",
): string | undefined {
  return value && value !== defaultValue ? value : undefined;
}

export function hasActiveRetrieval(
  values: Record<string, string>,
  defaults: Record<string, string>,
): boolean {
  return Object.entries(values).some(
    ([key, value]) => value !== (defaults[key] ?? ""),
  );
}
