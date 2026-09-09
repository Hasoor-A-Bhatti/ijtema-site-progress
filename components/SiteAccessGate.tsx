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

interface SiteAccessResponse {
  success?: boolean;
  authorised?: boolean;
  error?: string;
}

export default function SiteAccessGate({
  children,
}: SiteAccessGateProps) {
  const [
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    authorised,
    setAuthorised,
  ] =
    useState(false);

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  /*
   * Check the dedicated website-access cookie when
   * the gate first mounts.
   *
   * This intentionally checks /api/site-access only.
   * It does NOT touch the editor authentication system,
   * so entering the website does not enable editing.
   */
  useEffect(() => {
    let cancelled =
      false;

    const timeout =
      window.setTimeout(
        () => {
          async function checkSiteAccess() {
            try {
              const response =
                await fetch(
                  "/api/site-access",
                  {
                    method:
                      "GET",
                    cache:
                      "no-store",
                    credentials:
                      "same-origin",
                  }
                );

              const body =
                (await response
                  .json()
                  .catch(
                    () =>
                      null
                  )) as
                  | SiteAccessResponse
                  | null;

              if (
                cancelled
              ) {
                return;
              }

              if (
                response.ok &&
                body?.authorised
              ) {
                setAuthorised(
                  true
                );

                setError(
                  null
                );
              } else {
                setAuthorised(
                  false
                );

                if (
                  !response.ok &&
                  body?.error
                ) {
                  setError(
                    body.error
                  );
                }
              }
            } catch {
              if (
                cancelled
              ) {
                return;
              }

              setAuthorised(
                false
              );

              setError(
                "The site access check could not be completed."
              );
            } finally {
              if (
                !cancelled
              ) {
                setChecking(
                  false
                );
              }
            }
          }

          void checkSiteAccess();
        },
        0
      );

    return () => {
      cancelled =
        true;

      window.clearTimeout(
        timeout
      );
    };
  }, []);

  async function submitPassword(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitting
    ) {
      return;
    }

    const cleanPassword =
      password.trim();

    if (
      !cleanPassword
    ) {
      setError(
        "Enter the site password."
      );
      return;
    }

    setSubmitting(
      true
    );

    setError(
      null
    );

    try {
      const response =
        await fetch(
          "/api/site-access",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "same-origin",
            body:
              JSON.stringify(
                {
                  password:
                    cleanPassword,
                }
              ),
          }
        );

      const body =
        (await response
          .json()
          .catch(
            () =>
              null
          )) as
          | SiteAccessResponse
          | null;

      if (
        !response.ok ||
        !body?.authorised
      ) {
        throw new Error(
          body?.error ??
            "The password was not accepted."
        );
      }

      /*
       * WEBSITE ACCESS ONLY.
       *
       * Explicitly clear any OLD editor session that may
       * still exist in this browser from a previous visit.
       *
       * This is important because the old editor cookie
       * can otherwise survive while the new site-access
       * login succeeds, making the website appear to have
       * enabled editing automatically.
       *
       * We call the EXISTING editor lock endpoint. We never
       * call /api/editor/unlock here.
       */
      const lockResponse =
        await fetch(
          "/api/editor/lock",
          {
            method:
              "POST",
            credentials:
              "same-origin",
          }
        );

      if (
        !lockResponse.ok
      ) {
        throw new Error(
          "Website access succeeded, but the previous editing session could not be cleared."
        );
      }

      /*
       * Only reveal the website after the editor session
       * has definitely been cleared. When
       * EditorAccessProvider mounts, /api/editor/status
       * will therefore report View Only.
       */
      setAuthorised(
        true
      );

      setPassword(
        ""
      );
    } catch (
      loginError
    ) {
      setError(
        loginError instanceof
          Error
          ? loginError.message
          : "The password was not accepted."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  if (
    checking
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-white" />

          <p className="mt-4 text-sm font-medium text-slate-300">
            Checking site access…
          </p>
        </div>
      </div>
    );
  }

  if (
    authorised
  ) {
    return (
      <>
        {
          children
        }
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="bg-slate-950 px-6 py-7 text-white sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            National Ijtema 2026
          </p>

          <h1 className="mt-2 text-2xl font-semibold">
            Site Progress Access
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            Enter the site access password to continue.
          </p>
        </div>

        <form
          onSubmit={
            submitPassword
          }
          className="p-6 sm:p-7"
        >
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">
              Password
            </span>

            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={
                password
              }
              onChange={(
                event
              ) => {
                setPassword(
                  event
                    .target
                    .value
                );

                if (
                  error
                ) {
                  setError(
                    null
                  );
                }
              }}
              className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Enter password"
            />
          </label>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
              {
                error
              }
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting
            }
            className="mt-5 min-h-12 w-full rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? "Checking…"
              : "Enter Site"}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-slate-400">
            Website access and editing access are separate.
          </p>
        </form>
      </div>
    </main>
  );
}
