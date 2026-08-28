"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

import type { AreaType, SiteStatus } from "@/types/site";

const STATUS_PROGRESS: Record<SiteStatus, number> = {
  not_started: 0,
  laid: 25,
  preparing: 50,
  ready_for_inspection: 75,
  completed: 100,
};

interface AreaRow {
  id: string;
  name: string;
  area_type: AreaType;
  status: SiteStatus;
}

interface UrgentTaskRow {
  id: string;
  area_id: string;
  completed: boolean;
}

interface EquipmentRow {
  id: string;
  area_id: string;
  item_name: string;
  quantity_required: number;
  quantity_received: number;
  completed: boolean;
}

export interface AttentionArea {
  id: string;
  name: string;
  status: SiteStatus;
  urgentCount: number;
  equipmentOutstanding: number;
}

export interface DashboardMetrics {
  totalAreas: number;
  overallProgress: number;

  statusCounts: Record<SiteStatus, number>;

  urgentOutstanding: number;
  areasWithUrgentIssues: number;

  equipmentRequirements: number;
  equipmentConfirmed: number;
  equipmentProgress: number;

  readyForInspection: number;
  fullyCompleted: number;

  attentionAreas: AttentionArea[];
}

export default function useDashboardData() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<UrgentTaskRow[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshTimeout = useRef<number | null>(null);

  /*
   * LOAD DASHBOARD DATA
   */
  const loadDashboardData = useCallback(async () => {
    try {
      const [areasResult, urgentResult, equipmentResult] = await Promise.all([
        supabase
          .from("site_areas")
          .select("id, name, area_type, status"),

        supabase
          .from("urgent_tasks")
          .select("id, area_id, completed"),

        supabase
          .from("equipment_requirements")
          .select(
            "id, area_id, item_name, quantity_required, quantity_received, completed"
          ),
      ]);

      const firstError =
        areasResult.error ||
        urgentResult.error ||
        equipmentResult.error;

      if (firstError) {
        throw firstError;
      }

      setAreas((areasResult.data ?? []) as AreaRow[]);
      setUrgentTasks((urgentResult.data ?? []) as UrgentTaskRow[]);
      setEquipment((equipmentResult.data ?? []) as EquipmentRow[]);

      setError(null);
      setLastUpdated(new Date());
    } catch (loadError) {
      console.error("Failed to load dashboard data:", loadError);

      setError("Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * INITIAL LOAD
   *
   * Run asynchronously so React does not flag a synchronous
   * state-producing function call directly inside the effect.
   */
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDashboardData();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadDashboardData]);

  /*
   * REALTIME DASHBOARD UPDATES
   *
   * Multiple database events that happen close together are
   * combined into a single dashboard refresh.
   */
  useEffect(() => {
    function scheduleRefresh() {
      if (refreshTimeout.current !== null) {
        window.clearTimeout(refreshTimeout.current);
      }

      refreshTimeout.current = window.setTimeout(() => {
        refreshTimeout.current = null;
        void loadDashboardData();
      }, 150);
    }

    const channel = supabase
      .channel("dashboard-live-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_areas",
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "urgent_tasks",
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "equipment_requirements",
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimeout.current !== null) {
        window.clearTimeout(refreshTimeout.current);
        refreshTimeout.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  /*
   * CALCULATE DASHBOARD METRICS
   */
  const metrics = useMemo<DashboardMetrics>(() => {
    const statusCounts: Record<SiteStatus, number> = {
      not_started: 0,
      laid: 0,
      preparing: 0,
      ready_for_inspection: 0,
      completed: 0,
    };

    areas.forEach((area) => {
      statusCounts[area.status]++;
    });

    /*
     * OVERALL SITE PROGRESS
     */
    const totalProgress = areas.reduce(
      (total, area) => total + STATUS_PROGRESS[area.status],
      0
    );

    const overallProgress =
      areas.length > 0
        ? Math.round(totalProgress / areas.length)
        : 0;

    /*
     * URGENT ISSUES
     */
    const outstandingUrgentTasks = urgentTasks.filter(
      (task) => !task.completed
    );

    const urgentByArea = new Map<string, number>();

    outstandingUrgentTasks.forEach((task) => {
      urgentByArea.set(
        task.area_id,
        (urgentByArea.get(task.area_id) ?? 0) + 1
      );
    });

    /*
     * EQUIPMENT
     */
    const equipmentByArea = new Map<string, number>();

    const incompleteEquipment = equipment.filter((item) => {
      const fulfilled =
        item.quantity_received >= item.quantity_required &&
        item.completed;

      if (!fulfilled) {
        equipmentByArea.set(
          item.area_id,
          (equipmentByArea.get(item.area_id) ?? 0) + 1
        );
      }

      return !fulfilled;
    });

    const equipmentConfirmed =
      equipment.length - incompleteEquipment.length;

    /*
     * Equipment progress measures physical quantities on site.
     *
     * If 50 tables are required and 25 are present,
     * that requirement contributes 50% to physical readiness.
     */
    const totalRequired = equipment.reduce(
      (total, item) => total + item.quantity_required,
      0
    );

    const totalReceived = equipment.reduce(
      (total, item) =>
        total +
        Math.min(
          item.quantity_received,
          item.quantity_required
        ),
      0
    );

    const equipmentProgress =
      totalRequired > 0
        ? Math.round((totalReceived / totalRequired) * 100)
        : 0;

    /*
     * AREAS NEEDING ATTENTION
     *
     * Urgent issues are prioritised first, followed by
     * outstanding equipment requirements.
     */
    const attentionAreas: AttentionArea[] = areas
      .map((area) => ({
        id: area.id,
        name: area.name,
        status: area.status,
        urgentCount: urgentByArea.get(area.id) ?? 0,
        equipmentOutstanding:
          equipmentByArea.get(area.id) ?? 0,
      }))
      .filter(
        (area) =>
          area.urgentCount > 0 ||
          area.equipmentOutstanding > 0
      )
      .sort(
        (a, b) =>
          b.urgentCount - a.urgentCount ||
          b.equipmentOutstanding - a.equipmentOutstanding ||
          a.name.localeCompare(b.name)
      );

    return {
      totalAreas: areas.length,
      overallProgress,
      statusCounts,

      urgentOutstanding: outstandingUrgentTasks.length,
      areasWithUrgentIssues: urgentByArea.size,

      equipmentRequirements: equipment.length,
      equipmentConfirmed,
      equipmentProgress,

      readyForInspection:
        statusCounts.ready_for_inspection,

      fullyCompleted:
        statusCounts.completed,

      attentionAreas,
    };
  }, [areas, urgentTasks, equipment]);

  return {
    metrics,
    loading,
    error,
    lastUpdated,
    refresh: loadDashboardData,
  };
}