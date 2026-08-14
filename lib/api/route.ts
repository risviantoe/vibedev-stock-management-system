import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new InputError("Payload harus berupa object.");
    }

    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InputError) {
      throw error;
    }
    throw new InputError("Payload JSON tidak valid.");
  }
}

export function requiredString(
  input: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new InputError(`${label} wajib diisi.`);
  }
  return value.trim();
}

export function optionalString(
  input: Record<string, unknown>,
  key: string,
): string | null {
  const value = input[key];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new InputError(`${key} tidak valid.`);
  }
  return value.trim() || null;
}

export function requiredPositiveInteger(
  input: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = Number(input[key]);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InputError(`${label} harus bilangan bulat lebih dari 0.`);
  }
  return value;
}

export function requiredUuid(
  input: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = requiredString(input, key, label);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new InputError(`${label} tidak valid.`);
  }
  return value;
}

export function requiredDate(
  input: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = requiredString(input, key, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError(`${label} harus menggunakan format tanggal yang valid.`);
  }
  return value;
}

export function optionalDateTime(
  input: Record<string, unknown>,
  key: string,
): string {
  const value = optionalString(input, key);
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new InputError("Waktu transaksi tidak valid.");
  }
  return parsed.toISOString();
}

export function requiredEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  label: string,
  values: readonly T[],
): T {
  const value = requiredString(input, key, label) as T;
  if (!values.includes(value)) {
    throw new InputError(`${label} tidak valid.`);
  }
  return value;
}

type AuthenticatedHandler = (
  supabase: SupabaseClient,
  body: Record<string, unknown>,
) => Promise<unknown>;

export async function handleAuthenticatedPost(
  request: Request,
  handler: AuthenticatedHandler,
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sesi Anda telah berakhir." } },
        { status: 401 },
      );
    }

    const body = await readJsonObject(request);
    const data = await handler(supabase, body);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof InputError) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: error.message } },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message } },
      { status: 500 },
    );
  }
}

export function unwrapRpc<T>(
  result: { data: T | null; error: { code?: string; message: string } | null },
  fallback: string,
): T {
  if (result.error || result.data === null) {
    throw new InputError(result.error?.message || fallback);
  }
  return result.data;
}
