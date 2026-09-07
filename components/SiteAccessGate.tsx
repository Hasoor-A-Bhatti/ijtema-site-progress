"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";

interface SiteAccessGateProps {
  children: ReactNode;
}

export default function SiteAccessGate({
  children,
}: SiteAccessGateProps) {
  const [checking, setChecking] =
    useState(true);

  const [allowed, setAllowed] =
    useState(false);

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  /*
   * Check whether the existing
   * editor session is already valid.
   */
  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      try {
        const response = await fetch(
          "/api/editor/status",
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!cancelled) {
          setAllowed(
            Boolean(
              data.authenticated ??
                data.unlocked ??
                data.editingEnabled
            )
          );
        }
      } catch {
        if (!cancelled) {
          setAllowed(false);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!password.trim()) {
      setError(
        "Please enter the entry password."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/editor/unlock",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            password,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Incorrect password."
        );
      }

      setAllowed(true);
      setPassword("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Incorrect password."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Prevent the map flashing
   * briefly while session status
   * is being checked.
   */
  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </main>
    );
  }

  /*
   * Existing valid editor session:
   * show website normally.
   */
  if (allowed) {
    return <>{children}</>;
  }

  /*
   * ENTRY SCREEN
   */
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white p-7 shadow-2xl">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path
                  d="M7 10V8a5 5 0 0 1 10 0v2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-slate-900">
              National Ijtema 2026
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Site Progress Portal
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="entry-password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Entry Password
              </label>

              <input
                id="entry-password"
                type="password"
                autoFocus
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value
                  );

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Enter password"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading
                ? "Checking..."
                : "Enter Site"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Authorised access only
        </p>
      </div>
    </main>
  );
}