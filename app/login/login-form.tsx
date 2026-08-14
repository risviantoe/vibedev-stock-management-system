"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ButtonContent } from "@/components/ui/loading-indicator";
import { Button } from "@/components/ui/button";
import { TextInputField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";

type LoginFormProps = {
  demoEmail?: string;
  demoPassword?: string;
};

export function LoginForm({
  demoEmail = "",
  demoPassword = "",
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    formRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage("Email atau password tidak cocok.");
        return;
      }

      const requestedNext = searchParams.get("next");
      const destination =
        requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
          ? requestedNext
          : "/";

      router.replace(destination);
      router.refresh();
    } catch {
      setErrorMessage(
        "Login belum dapat diproses. Periksa konfigurasi dan coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="login-form"
      data-hydrated="false"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <TextInputField
        autoComplete="email"
        defaultValue={demoEmail}
        inputMode="email"
        label="Email"
        name="email"
        placeholder="admin@stokledger.demo"
        required
        type="email"
      />

      <TextInputField
        autoComplete="current-password"
        defaultValue={demoPassword}
        label="Password"
        minLength={8}
        name="password"
        placeholder="Minimal 8 karakter"
        required
        type="password"
      />

      {errorMessage ? <FormMessage tone="error">{errorMessage}</FormMessage> : null}

      <Button className="h-11 w-full" isDisabled={isSubmitting} type="submit">
        <ButtonContent isLoading={isSubmitting} loadingLabel="Memverifikasi akun…">
          Masuk sebagai Admin
        </ButtonContent>
      </Button>
    </form>
  );
}
