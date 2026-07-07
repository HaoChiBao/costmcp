"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/ui/form-field";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Account</p>
        <h1 className="auth-page__title">Sign in</h1>
        <p className="text-muted">Access your organized cost accounts.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <FormField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error ? <FormError message={error} /> : null}
          <Button type="submit" variant="ink" block disabled={loading}>
            {loading ? "Signing in…" : "Continue"}
          </Button>
        </form>
        <p className="auth-form__footer">
          No account? <Link href="/signup">Create one</Link>
        </p>
        <Link href="/" className="btn btn--ghost auth-card__back">
          Back home
        </Link>
      </div>
    </main>
  );
}
