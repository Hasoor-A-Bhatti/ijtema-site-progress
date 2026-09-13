"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  SiteTowerLight,
} from "@/types/towerLights";

interface TowerLightsResponse {
  success?: boolean;
  lights?: SiteTowerLight[];
  error?: string;
}

export default function useTowerLights() {
  const [
    lights,
    setLights,
  ] =
    useState<
      SiteTowerLight[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const mountedRef =
    useRef(true);

  const refresh =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/tower-lights",
              {
                cache:
                  "no-store",
              }
            );

          const body =
            (await response
              .json()
              .catch(
                () => null
              )) as
              | TowerLightsResponse
              | null;

          if (
            !response.ok ||
            !body?.success
          ) {
            throw new Error(
              body?.error ??
                "Tower lights could not be loaded."
            );
          }

          if (
            mountedRef.current
          ) {
            setLights(
              body.lights ??
                []
            );

            setError(null);
          }
        } catch (
          refreshError
        ) {
          console.error(
            "Failed to refresh tower lights:",
            refreshError
          );

          if (
            mountedRef.current
          ) {
            setError(
              refreshError instanceof
                Error
                ? refreshError.message
                : "Tower lights could not be loaded."
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    mountedRef.current =
      true;

    /*
     * Schedule the initial refresh outside the synchronous
     * effect body. This avoids React's set-state-in-effect
     * warning while keeping the same behaviour.
     */
    const initialRefresh =
      window.setTimeout(
        () => {
          void refresh();
        },
        0
      );

    /*
     * Lightweight cross-device refresh.
     *
     * The tower-light count is very small, so a 15-second
     * operational refresh keeps other phones/tablets in
     * sync without exposing these tables directly to the
     * browser or requiring extra realtime RLS policies.
     */
    const interval =
      window.setInterval(
        () => {
          void refresh();
        },
        15000
      );

    function refreshOnFocus() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      refreshOnFocus
    );

    window.addEventListener(
      "focus",
      refreshOnFocus
    );

    return () => {
      mountedRef.current =
        false;

      window.clearTimeout(
        initialRefresh
      );

      window.clearInterval(
        interval
      );

      document.removeEventListener(
        "visibilitychange",
        refreshOnFocus
      );

      window.removeEventListener(
        "focus",
        refreshOnFocus
      );
    };
  }, [
    refresh,
  ]);

  return {
    lights,
    loading,
    error,
    refresh,
  };
}
