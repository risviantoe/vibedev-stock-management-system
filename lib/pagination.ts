export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export type PaginationSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePage(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function parsePageSize(
  value: string | string[] | undefined,
): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number(candidate);

  return PAGE_SIZE_OPTIONS.includes(
    parsed as (typeof PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

export function getPageRange(
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function toPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
