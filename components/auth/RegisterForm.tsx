"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created but sign-in failed. Please try logging in.");
    } else {
      router.push("/c");
      router.refresh();
    }
  }

  return (
    <div className="rounded-2xl p-8 shadow-sm" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
      <h1 className="mb-1 text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>Create account</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Get started with Twix
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ border: "1px solid var(--color-border)" }}
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ border: "1px solid var(--color-border)" }}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ border: "1px solid var(--color-border)" }}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 transition-colors"
          style={{ background: "var(--color-accent)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-accent)")}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Already have an account?{" "}
        <Link href="/login" className="hover:underline" style={{ color: "var(--color-accent)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
