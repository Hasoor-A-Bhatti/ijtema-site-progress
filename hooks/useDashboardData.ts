"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ALL_STATUS_ORDER,
  getStatusOrder,
} from "@/config/statuses";
import { supabase } from "@/lib/supabase";

import type {
  AreaType,
  SiteStatus,
} from "@/types/site";

interface SiteAreaRow {
  id: string;
  name: string;
  area_type: string;
  status: SiteStatus;
}

interface UrgentTaskRow {
  id: string;
  area_id: string;
  task_text: string;
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
  areaType: string;
  status: SiteStatus;
  urgentCount: number;
  equipmentOutstanding: number;
}

export interface InspectionItem {
  id: string;
  name: string;
  areaType: string;
  status: SiteStatus;
}

export interface UrgentIssueSummary {
  id: string;
  areaId: string;
  areaName: string;
  areaType: string;
  taskText: string;
}

export interface EquipmentAttentionArea {
  id: string;
  name: string;
  outstandingRequirements: number;
  outstandingQuantity: number;
}

export interface WorkstreamMetric {
  key: "areas" | "metal_tracking" | "rubber_tracking" | "fence";
  label: string;
  total: number;
  progress: number;
  completed: number;
  ready: number;
  statusCounts: Record<SiteStatus, number>;
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
  areasWithEquipmentIssues: number;

  readyForInspection: number;
  fullyCompleted: number;

  attentionAreas: AttentionArea[];
  inspectionQueue: InspectionItem[];
  urgentIssues: UrgentIssueSummary[];
  equipmentAttention: EquipmentAttentionArea[];

  workstreams: WorkstreamMetric[];
}

function createStatusCounts(): Record<SiteStatus, number> {
  return ALL_STATUS_ORDER.reduce(
    (counts, status) => {
      counts[status] = 0;
      return counts;
    },
    {} as Record<SiteStatus, number>
  );
}

const EMPTY_METRICS: DashboardMetrics = {
  totalAreas: 0,
  overallProgress: 0,

  statusCounts: createStatusCounts(),

  urgentOutstanding: 0,
  areasWithUrgentIssues: 0,

  equipmentRequirements: 0,
  equipmentConfirmed: 0,
  equipmentProgress: 0,
  areasWithEquipmentIssues: 0,

  readyForInspection: 0,
  fullyCompleted: 0,

  attentionAreas: [],
  inspectionQueue: [],
  urgentIssues: [],
  equipmentAttention: [],
  workstreams: [],
};

function getAreaProgress(area: SiteAreaRow) {
  const order = getStatusOrder(area.area_type as AreaType);
  const stageIndex = order.indexOf(area.status);

  if (stageIndex < 0 || order.length <= 1) return 0;

  return stageIndex / (order.length - 1);
}

function calculateProgress(areas: SiteAreaRow[]) {
  if (areas.length === 0) return 0;

  const total = areas.reduce(
    (sum, area) => sum + getAreaProgress(area),
    0
  );

  return Math.round((total / areas.length) * 100);
}

function calculateStatusCounts(areas: SiteAreaRow[]) {
  const counts = createStatusCounts();

  areas.forEach((area) => {
    if (area.status in counts) {
      counts[area.status] += 1;
    }
  });

  return counts;
}

function getWorkstreamKey(
  areaType: string
): WorkstreamMetric["key"] {
  if (areaType === "metal_tracking") return "metal_tracking";
  if (areaType === "rubber_tracking") return "rubber_tracking";
  if (areaType === "fence") return "fence";

  return "areas";
}

const WORKSTREAMS: Array<{
  key: WorkstreamMetric["key"];
  label: string;
}> = [
  {
    key: "areas",
    label: "Marquees / Areas",
  },
  {
    key: "metal_tracking",
    label: "Metal Tracking",
  },
  {
    key: "rubber_tracking",
    label: "Rubber Tracking",
  },
  {
    key: "fence",
    label: "Fencing",
  },
];

export default function useDashboardData() {
  const [metrics, setMetrics] =
    useState<DashboardMetrics>(EMPTY_METRICS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);

      const [
        areasResult,
        urgentResult,
        equipmentResult,
      ] = await Promise.all([
        supabase
          .from("site_areas")
          .select("id, name, area_type, status"),

        supabase
          .from("urgent_tasks")
          .select("id, area_id, task_text, completed"),

        supabase
          .from("equipment_requirements")
          .select(
            "id, area_id, item_name, quantity_required, quantity_received, completed"
          ),
      ]);

      if (areasResult.error) throw areasResult.error;
      if (urgentResult.error) throw urgentResult.error;
      if (equipmentResult.error) throw equipmentResult.error;

      const areas = (areasResult.data ?? []) as SiteAreaRow[];
      const urgentTasks = (urgentResult.data ?? []) as UrgentTaskRow[];
      const equipment = (equipmentResult.data ?? []) as EquipmentRow[];

      const areaMap = new Map(
        areas.map((area) => [area.id, area])
      );

      const unresolvedTasks = urgentTasks.filter(
        (task) => !task.completed
      );

      const urgentByArea = new Map<string, UrgentTaskRow[]>();

      unresolvedTasks.forEach((task) => {
        const current = urgentByArea.get(task.area_id) ?? [];
        current.push(task);
        urgentByArea.set(task.area_id, current);
      });

      const outstandingEquipment = equipment.filter(
        (item) =>
          item.quantity_received < item.quantity_required ||
          !item.completed
      );

      const equipmentByArea = new Map<string, EquipmentRow[]>();

      outstandingEquipment.forEach((item) => {
        const current = equipmentByArea.get(item.area_id) ?? [];
        current.push(item);
        equipmentByArea.set(item.area_id, current);
      });

      const totalRequired = equipment.reduce(
        (sum, item) => sum + item.quantity_required,
        0
      );

      const totalReceived = equipment.reduce(
        (sum, item) =>
          sum +
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

      const equipmentConfirmed = equipment.filter(
        (item) =>
          item.completed &&
          item.quantity_received >= item.quantity_required
      ).length;

      const statusCounts = calculateStatusCounts(areas);

      const attentionAreas = areas
        .map((area) => ({
          id: area.id,
          name: area.name,
          areaType: area.area_type,
          status: area.status,
          urgentCount: urgentByArea.get(area.id)?.length ?? 0,
          equipmentOutstanding:
            equipmentByArea.get(area.id)?.length ?? 0,
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

      const inspectionQueue = areas
        .filter(
          (area) =>
            area.status === "ready_for_inspection"
        )
        .map((area) => ({
          id: area.id,
          name: area.name,
          areaType: area.area_type,
          status: area.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const urgentIssues = unresolvedTasks
        .map((task) => {
          const area = areaMap.get(task.area_id);

          return {
            id: task.id,
            areaId: task.area_id,
            areaName: area?.name ?? task.area_id,
            areaType: area?.area_type ?? "other",
            taskText: task.task_text,
          };
        })
        .sort((a, b) => a.areaName.localeCompare(b.areaName));

      const equipmentAttention = Array.from(
        equipmentByArea.entries()
      )
        .map(([areaId, items]) => {
          const area = areaMap.get(areaId);

          return {
            id: areaId,
            name: area?.name ?? areaId,
            outstandingRequirements: items.length,
            outstandingQuantity: items.reduce(
              (sum, item) =>
                sum +
                Math.max(
                  item.quantity_required -
                    item.quantity_received,
                  0
                ),
              0
            ),
          };
        })
        .sort(
          (a, b) =>
            b.outstandingRequirements -
              a.outstandingRequirements ||
            b.outstandingQuantity - a.outstandingQuantity
        );

      const workstreams = WORKSTREAMS.map(
        ({ key, label }) => {
          const workstreamAreas = areas.filter(
            (area) =>
              getWorkstreamKey(area.area_type) === key
          );

          return {
            key,
            label,
            total: workstreamAreas.length,
            progress: calculateProgress(workstreamAreas),
            completed: workstreamAreas.filter(
              (area) => area.status === "signed_off"
            ).length,
            ready: workstreamAreas.filter(
              (area) =>
                area.status === "ready_for_inspection"
            ).length,
            statusCounts:
              calculateStatusCounts(workstreamAreas),
          };
        }
      );

      setMetrics({
        totalAreas: areas.length,
        overallProgress: calculateProgress(areas),

        statusCounts,

        urgentOutstanding: unresolvedTasks.length,
        areasWithUrgentIssues: urgentByArea.size,

        equipmentRequirements: equipment.length,
        equipmentConfirmed,
        equipmentProgress,
        areasWithEquipmentIssues: equipmentByArea.size,

        readyForInspection:
          statusCounts.ready_for_inspection,

        fullyCompleted:
          statusCounts.signed_off,

        attentionAreas,
        inspectionQueue,
        urgentIssues,
        equipmentAttention,
        workstreams,
      });

      setLastUpdated(new Date());
    } catch (loadError) {
      console.error(
        "Failed to load dashboard data:",
        loadError
      );

      setError(
        "Live site information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadDashboardData();
    }, 0);

    let refreshTimer: number | null = null;

    function scheduleRefresh() {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void loadDashboardData();
      }, 150);
    }

    const channel = supabase
      .channel("dashboard-live-data")
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
      window.clearTimeout(initialLoad);

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  return {
    metrics,
    loading,
    error,
    lastUpdated,
    refresh: loadDashboardData,
  };
}
