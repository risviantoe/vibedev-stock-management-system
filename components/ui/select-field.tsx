"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Text } from "react-aria-components";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectInput,
  SelectItem,
  SelectList,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectFieldOption = {
  description?: string;
  disabled?: boolean;
  label: string;
  value: string;
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID");
}

export function SelectField({
  className,
  description,
  disabled = false,
  label,
  name,
  onChange,
  options,
  placeholder = "Pilih opsi",
  required = false,
  searchable = false,
  searchPlaceholder = "Cari pilihan",
  value,
}: {
  className?: string;
  description?: string;
  disabled?: boolean;
  label: ReactNode;
  name?: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  value: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const query = normalizeSearchText(searchQuery.trim());

    if (!searchable || !query) {
      return options;
    }

    return options.filter((option) =>
      normalizeSearchText(
        `${option.label} ${option.description ?? ""} ${option.value}`,
      ).includes(query),
    );
  }, [options, searchQuery, searchable]);

  const optionItems = filteredOptions.length ? (
    filteredOptions.map((option) => (
      <SelectItem
        id={option.value}
        isDisabled={option.disabled}
        key={option.value}
        textValue={option.label}
      >
        <span className="min-w-0">
          <span className="block font-medium">{option.label}</span>
          {option.description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {option.description}
            </span>
          ) : null}
        </span>
      </SelectItem>
    ))
  ) : (
    <SelectItem id="__empty__" isDisabled textValue="Tidak ada pilihan ditemukan">
      <span className="text-muted-foreground">Tidak ada pilihan ditemukan</span>
    </SelectItem>
  );

  return (
    <Select
      className={cn(
        "grid w-full min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-[0.42rem]",
        className,
      )}
      isDisabled={disabled}
      isRequired={required}
      name={name}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setSearchQuery("");
        }
      }}
      onSelectionChange={(key) => {
        onChange(key ? String(key) : "");
        setSearchQuery("");
      }}
      placeholder={placeholder}
      selectedKey={value || null}
    >
      <Label className="text-[length:var(--text-xs)] leading-[1.35] font-semibold">
        {label}
      </Label>
      <SelectTrigger className="data-[size=default]:h-[2.8rem]">
        <SelectValue>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </SelectValue>
      </SelectTrigger>
      {description ? (
        <Text className="text-xs leading-relaxed text-muted-foreground" slot="description">
          {description}
        </Text>
      ) : null}
      {searchable ? (
        <SelectPopover
          className="w-max min-w-(--trigger-width) max-w-[min(36rem,calc(100vw-2rem))]"
          placement="bottom start"
        >
          <SelectInput
            aria-label={searchPlaceholder}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
            value={searchQuery}
          />
          <SelectList>{optionItems}</SelectList>
        </SelectPopover>
      ) : (
        <SelectContent
          className="w-max min-w-(--trigger-width) max-w-[min(24rem,calc(100vw-2rem))]"
          placement="bottom start"
        >
          {optionItems}
        </SelectContent>
      )}
    </Select>
  );
}
