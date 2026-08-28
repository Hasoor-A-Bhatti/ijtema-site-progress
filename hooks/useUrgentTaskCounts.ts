"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

interface UrgentTaskRow {
  area_id: string;
  completed: boolean;
}

export default function useUrgentTaskCounts() {
  const [counts, setCounts] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function refreshCounts() {
      const { data, error } = await supabase
        .from("urgent_tasks")
        .select("area_id, completed");

      if (error) {
        console.error(
          "Failed to load urgent task counts:",
          error
        );
        return;
      }

      const nextCounts: Record<string, number> = {};

      ((data ?? []) as UrgentTaskRow[]).forEach(
        (task) => {
          if (task.completed) {
            return;
          }

          nextCounts[task.area_id] =
            (nextCounts[task.area_id] ?? 0) + 1;
        }
      );

      if (!cancelled) {
        setCounts(nextCounts);
      }
    }

    // Initial database load
    void refreshCounts();

    // Listen for live task changes
    const channel = supabase
      .channel("site-wide-urgent-task-counts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "urgent_tasks",
        },
        () => {
          void refreshCounts();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return counts;
}