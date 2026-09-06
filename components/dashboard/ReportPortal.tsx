"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import SiteReports from "./SiteReports";
import DepartmentReportWorkspace from "./DepartmentReportWorkspace";

import useSiteReports, {
  getLondonDateString,
} from "@/hooks/useSiteReports";

import { REPORT_LOGIN_OPTIONS } from "@/lib/reports/reportDepartments";

type ReportSessionView =
  | {
      role: "admin";
      label: string;
    }
  | {
      role: "department";
      departmentId: string;
      departmentName: string;
      nazimName: string;
    };

interface StatusResponse {
  authenticated: boolean;
  session: ReportSessionView | null;
  error?: string;
}

export default function ReportPortal() {
  const [session, setSession] = useState<ReportSessionView | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [reportDate, setReportDate] = useState(getLondonDateString());

  const isAdmin = session?.role === "admin";

  const {
    data: reportsData,
    loading: reportsLoading,
    error: reportsError,
    refresh: refreshReports,
  } = useSiteReports(reportDate, isAdmin);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);

    try {
      const response = await fetch("/api/reports/auth/status", {
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as
        | StatusResponse
        | null;

      if (!response.ok || !body) {
        setSession(null);
        setLoginError(body?.error ?? "Reporting access could not be checked.");
        return;
      }

      setSession(body.authenticated ? body.session : null);
    } catch {
      setSession(null);
      setLoginError("Reporting access could not be checked.");
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadSession();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSession]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId) {
      setLoginError("Select your department or Admin.");
      return;
    }

    if (!password) {
      setLoginError("Enter your reporting password.");
      return;
    }

    setSigningIn(true);
    setLoginError(null);

    try {
      const response = await fetch("/api/reports/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId,
          password,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            session?: ReportSessionView;
            error?: string;
          }
        | null;

      if (!response.ok || !body?.success || !body.session) {
        throw new Error(body?.error ?? "Invalid reporting credentials.");
      }

      setPassword("");
      setSession(body.session);

      if (body.session.role === "admin") {
        window.setTimeout(() => {
          void refreshReports();
        }, 0);
      }
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Invalid reporting credentials."
      );
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    setSigningOut(true);

    try {
      await fetch("/api/reports/auth/logout", {
        method: "POST",
      });
    } finally {
      setSession(null);
      setPassword("");
      setLoginError(null);
      setSigningOut(false);
    }
  }

  if (sessionLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="mt-3 text-sm text-slate-500">
            Checking reporting access…
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-full items-start justify-center bg-slate-50 p-4 py-8 sm:p-8 sm:py-12">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="bg-slate-950 px-5 py-6 text-white sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              National Ijtema 2026
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Site Reporting</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Select your department and sign in to access your reporting area.
            </p>
          </div>

          <form onSubmit={signIn} className="space-y-5 p-5 sm:p-7">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Department
              </span>

              <select
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value);
                  setLoginError(null);
                }}
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Select department…</option>
                {REPORT_LOGIN_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Password
              </span>

              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginError(null);
                }}
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter reporting password"
              />
            </label>

            {loginError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="min-h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              {signingIn ? "Signing in…" : "Sign In"}
            </button>

            <p className="text-center text-xs leading-5 text-slate-400">
              Reporting access is limited to the selected department. Admin access can view all departments.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Reporting Access
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {session.role === "admin"
              ? "Admin — All Departments"
              : `${session.departmentName} — ${session.nazimName}`}
          </p>
        </div>

        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>

      {session.role === "admin" ? (
        <SiteReports
          reportDate={reportDate}
          data={reportsData}
          loading={reportsLoading}
          error={reportsError}
          onDateChange={setReportDate}
          onRefresh={refreshReports}
        />
      ) : (
        <DepartmentReportWorkspace
          session={session}
          onSessionExpired={() => setSession(null)}
        />
      )}
    </div>
  );
}
