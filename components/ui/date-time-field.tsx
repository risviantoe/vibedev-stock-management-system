"use client";

import {
  CalendarDate,
  CalendarDateTime,
  Time,
  parseDate,
  parseDateTime,
  type DateValue,
} from "@internationalized/date";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker,
  DatePickerStateContext,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  Text,
} from "react-aria-components";
import { useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

const hourOptions = Array.from({ length: 24 }, (_, hour) => {
  const value = String(hour).padStart(2, "0");
  return { label: value, value };
});

const minuteOptions = Array.from({ length: 60 }, (_, minute) => {
  const value = String(minute).padStart(2, "0");
  return { label: value, value };
});

function parseValue(value: string, includeTime: boolean): DateValue | null {
  if (!value) return null;
  try {
    return includeTime ? parseDateTime(value.slice(0, 19)) : parseDate(value.slice(0, 10));
  } catch {
    return null;
  }
}

function serializeValue(value: DateValue | null, includeTime: boolean) {
  if (!value) return "";
  if (includeTime) {
    if (value instanceof CalendarDateTime) {
      return value.toString().slice(0, 16);
    }

    return `${value.toString().slice(0, 10)}T00:00`;
  }
  if (!includeTime && value instanceof CalendarDate) return value.toString();
  return value.toString().slice(0, 10);
}

function CalendarTimeField({ disabled }: { disabled: boolean }) {
  const state = useContext(DatePickerStateContext);

  if (!state) return null;

  return (
    <div
      aria-label="Pilih waktu"
      className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"
      data-slot="calendar-time-picker"
      role="group"
    >
      <SelectField
        className="[&_[data-slot=select-trigger]]:h-10"
        disabled={disabled}
        label="Jam"
        onChange={(hour) => {
          state.setTimeValue(
            new Time(Number(hour), state.timeValue?.minute ?? 0),
          );
        }}
        options={hourOptions}
        placeholder="Jam"
        value={
          state.timeValue
            ? String(state.timeValue.hour).padStart(2, "0")
            : ""
        }
      />
      <SelectField
        className="[&_[data-slot=select-trigger]]:h-10"
        disabled={disabled}
        label="Menit"
        onChange={(minute) => {
          state.setTimeValue(
            new Time(state.timeValue?.hour ?? 0, Number(minute)),
          );
        }}
        options={minuteOptions}
        placeholder="Menit"
        value={
          state.timeValue
            ? String(state.timeValue.minute).padStart(2, "0")
            : ""
        }
      />
    </div>
  );
}

export function DateTimeField({
  className,
  description,
  disabled = false,
  includeTime = false,
  label,
  name,
  onChange,
  required = false,
  value,
}: {
  className?: string;
  description?: string;
  disabled?: boolean;
  includeTime?: boolean;
  label: ReactNode;
  name?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const parsedValue = parseValue(value, includeTime);

  return (
    <DatePicker
      className={cn("grid min-w-0 content-start gap-[0.42rem]", className)}
      data-slot="date-time-field"
      granularity={includeTime ? "minute" : "day"}
      hideTimeZone
      hourCycle={24}
      isDisabled={disabled}
      isRequired={required}
      name={name}
      onChange={(nextValue) => onChange(serializeValue(nextValue, includeTime))}
      shouldCloseOnSelect={!includeTime}
      shouldForceLeadingZeros
      value={parsedValue}
    >
      <Label className="text-[length:var(--text-xs)] leading-[1.35] font-semibold">
        {label}
      </Label>
      <Group className="flex h-[2.8rem] min-w-0 items-center gap-1 rounded-lg border border-input bg-transparent pl-2.5 pr-1 text-sm transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:bg-input/50 data-disabled:opacity-50">
        <DateInput
          className="flex min-w-0 flex-1 flex-wrap items-center py-1 font-normal tabular-nums"
          data-slot="date-input"
        >
          {(segment) => (
            <DateSegment
              className="rounded-sm px-0.5 py-0.5 outline-none data-[type=literal]:px-0 data-placeholder:text-muted-foreground data-focused:bg-primary data-focused:text-primary-foreground"
              segment={segment}
            >
              {includeTime && segment.type === "literal"
                ? segment.text.replaceAll(".", ":")
                : segment.text}
            </DateSegment>
          )}
        </DateInput>
        <Button
          aria-label="Buka kalender"
          className="shrink-0"
          size="icon"
          type="button"
          variant="ghost"
        >
          <CalendarDays aria-hidden="true" />
        </Button>
      </Group>
      {description ? (
        <Text className="text-xs leading-relaxed text-muted-foreground" slot="description">
          {description}
        </Text>
      ) : null}
      <Popover
        className="z-70 min-w-[20.5rem] max-w-[min(24rem,calc(100vw-2rem))] overflow-visible rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95"
        data-slot="calendar-popover"
        offset={8}
        placement="bottom end"
      >
        <Dialog className="outline-none">
          <Calendar className="w-full" data-slot="calendar">
            <header className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <Button
                aria-label="Bulan sebelumnya"
                size="icon"
                slot="previous"
                variant="ghost"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Heading className="text-center text-sm font-medium" />
              <Button
                aria-label="Bulan berikutnya"
                size="icon"
                slot="next"
                variant="ghost"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </header>
            <CalendarGrid className="w-full border-separate border-spacing-1">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="h-8 text-center text-xs font-medium text-muted-foreground">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    className="grid size-9 cursor-pointer place-items-center rounded-lg text-sm outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-40 data-focus-visible:ring-3 data-focus-visible:ring-ring/50 data-outside-month:text-muted-foreground/50 data-selected:bg-primary data-selected:font-medium data-selected:text-primary-foreground"
                    data-slot="calendar-cell"
                    date={date}
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
          {includeTime ? <CalendarTimeField disabled={disabled} /> : null}
        </Dialog>
      </Popover>
    </DatePicker>
  );
}
