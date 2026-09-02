"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  DepartmentReport,
  ReportDepartment,
  ReportStatus,
} from "@/types/reports";

export interface ReportingDepartmentState {
  department:
    ReportDepartment;

  report:
    DepartmentReport
    | null;

  status:
    ReportStatus;

  completedFields:
    number;

  totalFields:
    number;

  deadlineAt:
    string;
}

export interface SiteReportsData {
  reportDate:
    string;

  serverTime:
    string;

  deadlineAt:
    string;

  totalDepartments:
    number;

  submitted:
    number;

  summary: Record<
    ReportStatus,
    number
  >;

  departments:
    ReportingDepartmentState[];
}

/*
 * Returns today's calendar date in
 * Europe/London regardless of the device
 * or server timezone.
 */
export function getLondonDateString(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/London",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  return `${values.year}-${values.month}-${values.day}`;
}

export default function useSiteReports(
  reportDate: string,

  /*
   * The reporting APIs are intentionally protected.
   *
   * Passing false means no reporting network
   * request will be made.
   */
  enabled = true
) {
  const [
    data,
    setData,
  ] =
    useState<SiteReportsData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null
    );

  /*
   * LOAD REPORTING DATA
   */
  const loadReports =
    useCallback(
      async () => {
        /*
         * Never call the protected reporting API
         * while editing access is disabled.
         */
        if (!enabled) {
          return;
        }

        try {
          setError(null);

          const response =
            await fetch(
              `/api/reports?date=${encodeURIComponent(
                reportDate
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const result =
            (await response
              .json()
              .catch(
                () => ({})
              )) as
              | SiteReportsData
              | {
                  error?: string;
                };

          if (
            !response.ok
          ) {
            throw new Error(
              "error" in
                  result &&
                result.error
                ? result.error
                : "Site reports could not be loaded."
            );
          }

          setData(
            result as SiteReportsData
          );

          setLastUpdated(
            new Date()
          );
        } catch (
          loadError
        ) {
          console.error(
            "Failed to load site reports:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Site reports could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        reportDate,
        enabled,
      ]
    );

  /*
   * INITIAL LOAD + POLLING
   *
   * Reporting only polls while authorised.
   *
   * When access is locked or expires:
   * → reporting data is removed from memory
   * → polling stops
   * → protected API is no longer called
   */
  useEffect(() => {
    const initialLoad =
      window.setTimeout(
        () => {
          if (!enabled) {
            setData(null);
            setError(null);
            setLastUpdated(null);
            setLoading(false);

            return;
          }

          setLoading(true);
          setData(null);

          void loadReports();
        },
        0
      );

    if (!enabled) {
      return () => {
        window.clearTimeout(
          initialLoad
        );
      };
    }

    /*
     * Reporting data doesn't need sub-second
     * realtime behaviour. A protected refresh
     * every 30 seconds is sufficient for the
     * conference dashboard.
     */
    const polling =
      window.setInterval(
        () => {
          void loadReports();
        },
        30000
      );

    return () => {
      window.clearTimeout(
        initialLoad
      );

      window.clearInterval(
        polling
      );
    };
  }, [
    enabled,
    loadReports,
  ]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh:
      loadReports,
  };
}