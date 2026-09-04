"use client";

import {
  useEffect,
  useState,
} from "react";

import DashboardOverlay, {
  type DashboardTab,
} from "./DashboardOverlay";

export default function DashboardLauncher() {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    initialTab,
    setInitialTab,
  ] =
    useState<DashboardTab>(
      "summary"
    );

  /*
   * Deep-link support.
   *
   * Examples:
   *
   * ?dashboard=reports
   * ?dashboard=summary
   *
   * Equipment is deliberately NOT opened
   * automatically because it remains protected.
   */
  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          const params =
            new URLSearchParams(
              window.location.search
            );

          const dashboard =
            params.get(
              "dashboard"
            );

          if (
            dashboard ===
            "reports"
          ) {
            setInitialTab(
              "reports"
            );

            setOpen(true);
          }

          if (
            dashboard ===
            "summary"
          ) {
            setInitialTab(
              "summary"
            );

            setOpen(true);
          }
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, []);

  function openDashboard() {
    setInitialTab(
      "summary"
    );

    setOpen(true);
  }

  function closeDashboard() {
    setOpen(false);

    /*
     * Remove ?dashboard=reports after closing.
     *
     * Otherwise refreshing the page would
     * immediately reopen the dashboard.
     *
     * Other query parameters are preserved.
     */
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.delete(
      "dashboard"
    );

    const nextUrl =
      `${url.pathname}${url.search}${url.hash}`;

    window.history.replaceState(
      {},
      "",
      nextUrl
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={
          openDashboard
        }
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
      >
        Dashboard
      </button>

      {open && (
        <DashboardOverlay
          initialTab={
            initialTab
          }
          onClose={
            closeDashboard
          }
        />
      )}
    </>
  );
}