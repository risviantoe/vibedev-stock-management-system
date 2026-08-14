"use client";

import {
  LoaderCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SelectField,
  type SelectFieldOption,
} from "@/components/ui/select-field";
import { DateTimeField } from "@/components/ui/date-time-field";

export type RetrievalField = {
  defaultValue: string;
  kind?: "select" | "date";
  label: string;
  name: string;
  options?: SelectFieldOption[];
  value: string;
};

type OperationalTableToolbarProps = {
  anchor?: string;
  fields: RetrievalField[];
  pageParam?: string;
  searchLabel: string;
  searchParam: string;
  searchPlaceholder: string;
  searchValue: string;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  );
}

export function OperationalTableToolbar({
  anchor,
  fields,
  pageParam = "page",
  searchLabel,
  searchParam,
  searchPlaceholder,
  searchValue,
}: OperationalTableToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const appliedValues = useMemo(
    () => ({
      [searchParam]: searchValue,
      ...Object.fromEntries(fields.map((field) => [field.name, field.value])),
    }),
    [fields, searchParam, searchValue],
  );
  const [values, setValues] = useState<Record<string, string>>(appliedValues);
  const [prevAppliedValues, setPrevAppliedValues] = useState(appliedValues);

  const hasAppliedValuesChanged =
    prevAppliedValues[searchParam] !== appliedValues[searchParam] ||
    fields.some(
      (field) => prevAppliedValues[field.name] !== field.value,
    );

  if (hasAppliedValuesChanged) {
    setPrevAppliedValues(appliedValues);
    setValues(appliedValues);
  }

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        const primaryShortcutTarget = document.querySelector(
          '[data-retrieval-search] input[aria-keyshortcuts="/"]',
        );
        if (searchInputRef.current !== primaryShortcutTarget) return;
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const controlledFields = useMemo(
    () => [
      { defaultValue: "", label: "Pencarian", name: searchParam },
      ...fields,
    ],
    [fields, searchParam],
  );
  const activeFilters = fields.filter(
    (field) => (appliedValues[field.name] ?? "") !== field.defaultValue,
  );

  function navigate(nextValues: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const field of controlledFields) {
      const value = (nextValues[field.name] ?? "").trim();
      if (!value || value === field.defaultValue) {
        nextParams.delete(field.name);
      } else {
        nextParams.set(field.name, value);
      }
    }
    nextParams.delete(pageParam);

    const query = nextParams.toString();
    const destination = `${pathname}${query ? `?${query}` : ""}${
      anchor ? `#${anchor}` : ""
    }`;
    startTransition(() => router.push(destination));
  }

  function clearFilters() {
    const nextValues = {
      ...appliedValues,
      ...Object.fromEntries(
        fields.map((field) => [field.name, field.defaultValue]),
      ),
    };
    setValues(nextValues);
    navigate(nextValues);
  }

  function removeFilter(name: string) {
    const field = controlledFields.find((item) => item.name === name);
    if (!field) return;
    const nextValues = { ...appliedValues, [name]: field.defaultValue };
    setValues(nextValues);
    navigate(nextValues);
  }

  function activeFilterLabel(field: RetrievalField): string {
    const value = appliedValues[field.name] ?? "";
    const option = field.options?.find((item) => item.value === value);
    return `${field.label}: ${option?.label ?? value}`;
  }

  return (
    <form
      className="mt-3 grid gap-3 border-b border-border pb-4"
      onSubmit={(event) => {
        event.preventDefault();
        navigate({
          ...values,
          [searchParam]: (values[searchParam] ?? "").trim(),
        });
      }}
    >
      <div className="grid grid-cols-1 items-end gap-3 xl:grid-cols-[minmax(18rem,40rem)_auto]">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div
            className="grid min-w-0 gap-1.5"
            data-retrieval-search
          >
            <Label htmlFor={`${searchParam}-search`}>{searchLabel}</Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-keyshortcuts="/"
                className="h-10 pl-9 pr-10"
                id={`${searchParam}-search`}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [searchParam]: event.target.value,
                  }))
                }
                placeholder={searchPlaceholder}
                ref={searchInputRef}
                value={values[searchParam] ?? ""}
              />
              {values[searchParam] ? (
                <Button
                  aria-label="Kosongkan isian pencarian"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onPress={() => {
                    setValues((current) => ({
                      ...current,
                      [searchParam]: "",
                    }));
                    searchInputRef.current?.focus();
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              ) : (
                <kbd
                  aria-label="Tekan garis miring untuk fokus ke pencarian"
                  className="absolute right-2 top-1/2 hidden h-6 min-w-6 -translate-y-1/2 place-items-center rounded-md border border-border bg-muted px-1.5 font-sans text-xs font-medium text-muted-foreground sm:grid"
                >
                  /
                </kbd>
              )}
            </div>
          </div>
          <Button
            className="h-10 px-4"
            isDisabled={isPending}
            type="submit"
          >
            {isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
              />
            ) : null}
            {isPending ? "Mencari…" : "Cari"}
          </Button>
        </div>

        <Button
          aria-controls={`${searchParam}-filter-panel`}
          aria-expanded={filtersOpen}
          className="h-10 justify-self-stretch px-4 xl:justify-self-start"
          onPress={() => setFiltersOpen((current) => !current)}
          type="button"
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" />
          Filter dan urutkan
          {activeFilters.length ? (
            <span className="grid size-5 place-items-center rounded-full bg-primary text-[0.6875rem] font-semibold text-primary-foreground">
              {activeFilters.length}
            </span>
          ) : null}
        </Button>

        <div
          className={`${
            filtersOpen ? "grid" : "hidden"
          } min-w-0 grid-cols-1 items-end gap-3 border-t border-border pt-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4`}
          id={`${searchParam}-filter-panel`}
        >
          {fields.map((field) =>
            field.kind === "date" ? (
              <DateTimeField
                className="min-w-0"
                key={field.name}
                label={field.label}
                onChange={(value) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: value,
                  }))
                }
                value={values[field.name] ?? ""}
              />
            ) : (
              <SelectField
                className="min-w-0"
                key={field.name}
                label={field.label}
                onChange={(value) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: value,
                  }))
                }
                options={field.options ?? []}
                value={values[field.name] ?? field.defaultValue}
              />
            ),
          )}
          <div className="flex justify-end sm:col-span-2 xl:col-span-4">
            <Button
              className="h-10 w-full px-4 sm:w-auto"
              isDisabled={isPending}
              type="submit"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="animate-spin"
                />
              ) : null}
              {isPending ? "Menerapkan…" : "Terapkan filter dan urutan"}
            </Button>
          </div>
        </div>
      </div>

      {activeFilters.length ? (
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex min-w-0 flex-wrap gap-2"
            aria-label="Filter yang sedang digunakan"
          >
            {activeFilters.map((field) => (
              <Button
                aria-label={`Hapus ${activeFilterLabel(field)}`}
                className="h-8 rounded-full border-primary/20 bg-accent px-3 text-xs text-accent-foreground hover:bg-accent/70"
                key={field.name}
                onPress={() => removeFilter(field.name)}
                type="button"
                variant="outline"
              >
                {activeFilterLabel(field)}
                <X aria-hidden="true" className="size-3.5" />
              </Button>
            ))}
          </div>
          <Button
            className="shrink-0"
            onPress={clearFilters}
            type="button"
            variant="ghost"
          >
            Atur ulang filter dan urutan
          </Button>
        </div>
      ) : null}
    </form>
  );
}
