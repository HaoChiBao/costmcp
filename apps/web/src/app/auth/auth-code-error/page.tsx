import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Sign in</p>
        <h1 className="auth-page__title">Could not sign you in</h1>
        <p className="text-muted">
          The Google sign-in link expired or was already used. Try again from the login page.
        </p>
        <Link href="/login" className="btn btn--ink btn--block auth-card__action">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
