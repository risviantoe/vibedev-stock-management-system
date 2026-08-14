"use client";

import { useRouter } from "next/navigation";
import { SelectField } from "@/components/ui/select-field";
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";

type PaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  pageParam?: string;
  pageSizeParam?: string;
  query?: Record<string, string | number | undefined>;
  anchor?: string;
};

function getVisiblePages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 3) {
    end = 4;
  }
  if (currentPage >= totalPages - 2) {
    start = totalPages - 3;
  }

  const pages: Array<number | "ellipsis"> = [1];
  if (start > 2) {
    pages.push("ellipsis");
  }
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }
  if (end < totalPages - 1) {
    pages.push("ellipsis");
  }
  pages.push(totalPages);

  return pages;
}

function buildHref({
  basePath,
  page,
  pageParam,
  query,
  anchor,
}: {
  basePath: string;
  page: number;
  pageParam: string;
  query?: PaginationProps["query"];
  anchor?: string;
}): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && key !== pageParam) {
      params.set(key, String(value));
    }
  }
  if (page > 1) {
    params.set(pageParam, String(page));
  }

  const search = params.toString();
  return `${basePath}${search ? `?${search}` : ""}${anchor ? `#${anchor}` : ""}`;
}

export function Pagination({
  basePath,
  page,
  pageSize,
  total,
  pageParam = "page",
  pageSizeParam = "pageSize",
  query,
  anchor,
}: PaginationProps) {
  const router = useRouter();

  if (total === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  const visiblePages = getVisiblePages(page, totalPages);
  const paginationQuery = {
    ...query,
    [pageSizeParam]: pageSize === DEFAULT_PAGE_SIZE ? undefined : pageSize,
  };

  function changePageSize(value: string) {
    const nextPageSize = Number(value);
    router.push(
      buildHref({
        basePath,
        page: 1,
        pageParam,
        query: {
          ...query,
          [pageSizeParam]: nextPageSize === DEFAULT_PAGE_SIZE ? undefined : nextPageSize,
        },
        anchor,
      }),
    );
  }

  return (
    <div className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-muted-foreground">
          Menampilkan{" "}
          <strong className="text-foreground">
            {firstItem}–{lastItem}
          </strong>{" "}
          dari <strong className="text-foreground">{total}</strong> data
        </p>
        <SelectField
          className="w-full sm:w-auto [&_[data-slot=label]]:whitespace-nowrap [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=select-trigger]]:w-20"
          label="Data per halaman"
          onChange={changePageSize}
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            label: String(size),
            value: String(size),
          }))}
          value={String(pageSize)}
        />
      </div>
      <PaginationRoot
        aria-label="Navigasi halaman tabel"
        className="lg:mx-0 lg:w-auto lg:justify-end"
      >
        <PaginationContent>
          {hasPrevious ? (
            <PaginationItem>
              <PaginationPrevious
                aria-label="Buka halaman sebelumnya"
                href={buildHref({
                  basePath,
                  page: page - 1,
                  pageParam,
                  query: paginationQuery,
                  anchor,
                })}
                text="Sebelumnya"
              />
            </PaginationItem>
          ) : (
            <PaginationItem>
              <PaginationPrevious
                aria-label="Halaman sebelumnya tidak tersedia"
                isDisabled
                text="Sebelumnya"
              />
            </PaginationItem>
          )}
          {visiblePages.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  aria-label={
                    item === page ? `Halaman ${item}, halaman saat ini` : `Buka halaman ${item}`
                  }
                  href={buildHref({
                    basePath,
                    page: item,
                    pageParam,
                    query: paginationQuery,
                    anchor,
                  })}
                  isActive={item === page}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          {hasNext ? (
            <PaginationItem>
              <PaginationNext
                aria-label="Buka halaman berikutnya"
                href={buildHref({
                  basePath,
                  page: page + 1,
                  pageParam,
                  query: paginationQuery,
                  anchor,
                })}
                text="Berikutnya"
              />
            </PaginationItem>
          ) : (
            <PaginationItem>
              <PaginationNext
                aria-label="Halaman berikutnya tidak tersedia"
                isDisabled
                text="Berikutnya"
              />
            </PaginationItem>
          )}
        </PaginationContent>
      </PaginationRoot>
    </div>
  );
}
