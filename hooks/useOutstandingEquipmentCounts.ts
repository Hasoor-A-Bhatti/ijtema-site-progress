"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

interface EquipmentRequirementRow {
  area_id: string;
  quantity_required: number;
  quantity_received: number;
  completed: boolean;
}

function buildOutstandingCounts(
  rows: EquipmentRequirementRow[]
) {
  const counts:
    Record<string, number> =
      {};

  for (
    const row of rows
  ) {
    const outstanding =
      row.quantity_received <
        row.quantity_required ||
      !row.completed;

    if (!outstanding) {
      continue;
    }

    counts[row.area_id] =
      (counts[
        row.area_id
      ] ?? 0) + 1;
  }

  return counts;
}

export default function useOutstandingEquipmentCounts() {
  const [
    counts,
    setCounts,
  ] =
    useState<
      Record<
        string,
        number
      >
    >({});

  const mountedRef =
    useRef(true);

  const refresh =
    useCallback(
      async () => {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "equipment_requirements"
            )
            .select(
              "area_id, quantity_required, quantity_received, completed"
            );

        if (error) {
          console.error(
            "Failed to load outstanding equipment requirements:",
            error
          );
          return;
        }

        if (
          !mountedRef.current
        ) {
          return;
        }

        setCounts(
          buildOutstandingCounts(
            (data ??
              []) as EquipmentRequirementRow[]
          )
        );
      },
      []
    );

  useEffect(() => {
    mountedRef.current =
      true;

    /*
     * Defer the initial state-producing refresh so it
     * does not synchronously set React state inside
     * the effect body.
     */
    const initialRefresh =
      window.setTimeout(
        () => {
          void refresh();
        },
        0
      );

    /*
     * Realtime makes the EQ marker disappear quickly
     * after the final requirement is fulfilled.
     */
    const channel =
      supabase
        .channel(
          "equipment-requirement-map-indicators"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "equipment_requirements",
          },
          () => {
            void refresh();
          }
        )
        .subscribe();

    /*
     * Small fallback refresh in case realtime is not
     * enabled for this table in a particular Supabase
     * environment.
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

      void supabase.removeChannel(
        channel
      );
    };
  }, [
    refresh,
  ]);

  return counts;
}
