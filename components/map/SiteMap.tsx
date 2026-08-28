"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import AreaDetailsCard from "@/components/area/AreaDetailsCard";
import ProgressSummary from "@/components/dashboard/ProgressSummary";
import MapToolbar from "@/components/map/MapToolbar";
import SiteAreaLayer from "@/components/map/SiteAreaLayer";
import TraceLayer from "@/components/map/TraceLayer";

import { siteAreas } from "@/data/siteAreas";
import useUrgentTaskCounts from "@/hooks/useUrgentTaskCounts";
import { supabase } from "@/lib/supabase";

import type { MapPoint, SiteStatus } from "@/types/site";

const MAP_WIDTH = 2384;
const MAP_HEIGHT = 3370;

const INITIAL_STATUSES = Object.fromEntries(
  siteAreas.map((area) => [area.id, area.status])
) as Record<string, SiteStatus>;

const TRANSFORM_WRAPPER_STYLE = {
  width: "100%",
  height: "100%",
};

const TRANSFORM_CONTENT_STYLE = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
};

export default function SiteMap() {
  const [traceMode, setTraceMode] = useState(false);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [areaStatuses, setAreaStatuses] =
    useState<Record<string, SiteStatus>>(INITIAL_STATUSES);

  const urgentTaskCounts = useUrgentTaskCounts();

  const selectedArea = useMemo(
    () => siteAreas.find((area) => area.id === selectedAreaId) ?? null,
    [selectedAreaId]
  );

  /*
   * LOAD SAVED STATUSES
   */
  useEffect(() => {
    let cancelled = false;

    async function loadStatuses() {
      const { data, error } = await supabase
        .from("site_areas")
        .select("id, status");

      if (error) {
        console.error("Failed to load site statuses:", error);
        return;
      }

      if (cancelled) return;

      setAreaStatuses((current) => {
        const updated = { ...current };

        data?.forEach((area) => {
          updated[area.id] = area.status as SiteStatus;
        });

        return updated;
      });
    }

    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * REALTIME STATUS UPDATES
   */
  useEffect(() => {
    const channel = supabase
      .channel("site-area-status-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_areas",
        },
        (payload) => {
          const updatedArea = payload.new as {
            id: string;
            status: SiteStatus;
          };

          setAreaStatuses((current) => ({
            ...current,
            [updatedArea.id]: updatedArea.status,
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  /*
   * STATUS UPDATE
   *
   * Optimistic update in the browser.
   * Actual database write is handled by the protected Next.js API.
   */
  async function updateAreaStatus(areaId: string, status: SiteStatus) {
    const previousStatus = areaStatuses[areaId] ?? "not_started";

    setAreaStatuses((current) => ({
      ...current,
      [areaId]: status,
    }));

    try {
      const response = await fetch(
        `/api/site-areas/${encodeURIComponent(areaId)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "The progress update could not be saved."
        );
      }
    } catch (error) {
      console.error("Failed to save area status:", error);

      setAreaStatuses((current) => ({
        ...current,
        [areaId]: previousStatus,
      }));

      alert(
        error instanceof Error
          ? error.message
          : "The progress update could not be saved."
      );
    }
  }

  /*
   * MAP / TRACE CLICK
   */
  function handleMapClick(event: MouseEvent<SVGSVGElement>) {
    if (!traceMode) {
      setSelectedAreaId(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    const x =
      ((event.clientX - rect.left) / rect.width) * MAP_WIDTH;

    const y =
      ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT;

    setPoints((current) => [
      ...current,
      {
        x: Math.round(x),
        y: Math.round(y),
      },
    ]);
  }

  function undoPoint() {
    setPoints((current) => current.slice(0, -1));
  }

  function clearPoints() {
    setPoints([]);
  }

  async function copyPoints() {
    const polygon = points
      .map((point) => `${point.x},${point.y}`)
      .join(" ");

    if (!polygon) return;

    try {
      await navigator.clipboard.writeText(polygon);
      alert("Polygon coordinates copied.");
    } catch {
      alert(
        "Could not copy automatically. Check browser clipboard permissions."
      );
    }
  }

  return (
    <div className="relative flex h-[calc(100dvh-72px)] w-full flex-col overflow-hidden bg-slate-100">
      <TransformWrapper
        minScale={0.7}
        maxScale={8}
        centerOnInit
        wheel={{ step: 0.1 }}
        pinch={{ disabled: traceMode }}
        doubleClick={{ disabled: traceMode }}
        panning={{ disabled: traceMode }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <MapToolbar
              traceMode={traceMode}
              pointsCount={points.length}
              onToggleTrace={() =>
                setTraceMode((current) => !current)
              }
              onUndo={undoPoint}
              onClear={clearPoints}
              onCopy={copyPoints}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetTransform}
            />

            <ProgressSummary
              areas={siteAreas}
              statuses={areaStatuses}
            />

            <div className="min-h-0 flex-1 overflow-hidden">
              <TransformComponent
                wrapperStyle={TRANSFORM_WRAPPER_STYLE}
                contentStyle={TRANSFORM_CONTENT_STYLE}
              >
                <div
                  className="relative w-[850px] max-w-none select-none"
                  style={{
                    aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
                  }}
                >
                  {/* SITE PLAN */}
                  <img
                    src="/maps/site-map.svg"
                    alt="National Ijtema 2026 site plan"
                    draggable={false}
                    loading="eager"
                    fetchPriority="high"
                    className="pointer-events-none absolute inset-0 h-full w-full select-none"
                  />

                  {/* INTERACTIVE SVG LAYER */}
                  <svg
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    className={`absolute inset-0 h-full w-full ${
                      traceMode ? "cursor-crosshair" : ""
                    }`}
                    onClick={handleMapClick}
                  >
                    <SiteAreaLayer
                      areas={siteAreas}
                      statuses={areaStatuses}
                      urgentTaskCounts={urgentTaskCounts}
                      selectedAreaId={selectedAreaId}
                      traceMode={traceMode}
                      onSelectArea={setSelectedAreaId}
                    />

                    {(traceMode || points.length > 0) && (
                      <TraceLayer points={points} />
                    )}
                  </svg>
                </div>
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>

      {/* AREA DETAILS */}
      {selectedArea && (
        <AreaDetailsCard
          key={selectedArea.id}
          area={selectedArea}
          status={
            areaStatuses[selectedArea.id] ??
            selectedArea.status
          }
          onStatusChange={(status) =>
            updateAreaStatus(selectedArea.id, status)
          }
          onClose={() => setSelectedAreaId(null)}
        />
      )}
    </div>
  );
}