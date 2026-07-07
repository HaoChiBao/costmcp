"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/ui/form-field";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">New account</p>
        <h1 className="auth-page__title">Join CostMCP</h1>
        <p className="text-muted">One workspace with collections and categories, ready to go.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            label="Display name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
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
            minLength={6}
            required
            autoComplete="new-password"
          />
          {error ? <FormError message={error} /> : null}
          <Button type="submit" variant="ink" block disabled={loading}>
            {loading ? "Creating…" : "Get started"}
          </Button>
        </form>
        <p className="auth-form__footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
        <Link href="/" className="btn btn--ghost auth-card__back">
          Back home
        </Link>
      </div>
    </main>
  );
}
