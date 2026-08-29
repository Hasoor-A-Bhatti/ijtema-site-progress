"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";

import AreaDetailsCard from "@/components/area/AreaDetailsCard";
import ProgressSummary from "@/components/dashboard/ProgressSummary";
import InfrastructureLineLayer from "@/components/map/InfrastructureLineLayer";
import MapToolbar from "@/components/map/MapToolbar";
import SiteAreaLayer from "@/components/map/SiteAreaLayer";
import TraceLayer from "@/components/map/TraceLayer";

import type { MapView } from "@/components/map/MapToolbar";

import { infrastructureLines } from "@/data/infrastructureLines";
import { siteAreas } from "@/data/siteAreas";

import useUrgentTaskCounts from "@/hooks/useUrgentTaskCounts";

import { supabase } from "@/lib/supabase";

import type {
  MapPoint,
  SiteStatus,
} from "@/types/site";

const MAP_WIDTH = 2384;
const MAP_HEIGHT = 3370;

type TraceGeometry =
  | "area"
  | "line";

const ALL_FEATURES = [
  ...siteAreas,
  ...infrastructureLines,
];

const INITIAL_STATUSES = Object.fromEntries(
  ALL_FEATURES.map((feature) => [
    feature.id,
    feature.status,
  ])
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
  const [traceMode, setTraceMode] =
    useState(false);

  const [
    traceGeometry,
    setTraceGeometry,
  ] = useState<TraceGeometry>("area");

  const [mapView, setMapView] =
    useState<MapView>("all");

  const [points, setPoints] =
    useState<MapPoint[]>([]);

  const [
    selectedFeatureId,
    setSelectedFeatureId,
  ] = useState<string | null>(null);

  const [
    areaStatuses,
    setAreaStatuses,
  ] = useState<
    Record<string, SiteStatus>
  >(INITIAL_STATUSES);

  const urgentTaskCounts =
    useUrgentTaskCounts();

  /*
   * CURRENTLY SELECTED FEATURE
   */
  const selectedFeature = useMemo(
    () =>
      ALL_FEATURES.find(
        (feature) =>
          feature.id ===
          selectedFeatureId
      ) ?? null,
    [selectedFeatureId]
  );

  /*
   * FILTER POLYGON AREAS
   *
   * ALL:
   * Show site areas.
   *
   * MARQUEES:
   * Show site areas only.
   *
   * TRACKING / FENCE:
   * Hide site-area overlays completely.
   */
  const visibleSiteAreas =
    useMemo(() => {
      if (
        mapView === "all" ||
        mapView === "marquees"
      ) {
        return siteAreas;
      }

      return [];
    }, [mapView]);

  /*
   * FILTER INFRASTRUCTURE
   */
  const visibleInfrastructureLines =
    useMemo(() => {
      if (mapView === "all") {
        return infrastructureLines;
      }

      if (mapView === "tracking") {
        return infrastructureLines.filter(
          (line) =>
            line.type ===
              "metal_tracking" ||
            line.type ===
              "rubber_tracking"
        );
      }

      if (mapView === "fence") {
        return infrastructureLines.filter(
          (line) =>
            line.type === "fence"
        );
      }

      return [];
    }, [mapView]);

  /*
   * LOAD SAVED STATUSES
   */
  useEffect(() => {
    let cancelled = false;

    async function loadStatuses() {
      const {
        data,
        error,
      } = await supabase
        .from("site_areas")
        .select("id, status");

      if (error) {
        console.error(
          "Failed to load site statuses:",
          error
        );

        return;
      }

      if (cancelled) {
        return;
      }

      setAreaStatuses((current) => {
        const updated = {
          ...current,
        };

        data?.forEach((area) => {
          updated[area.id] =
            area.status as SiteStatus;
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
      .channel(
        "site-area-status-changes"
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_areas",
        },
        (payload) => {
          const updatedArea =
            payload.new as {
              id: string;
              status: SiteStatus;
            };

          setAreaStatuses(
            (current) => ({
              ...current,
              [updatedArea.id]:
                updatedArea.status,
            })
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, []);

  /*
   * STATUS UPDATE
   */
  async function updateAreaStatus(
    featureId: string,
    status: SiteStatus
  ) {
    const previousStatus =
      areaStatuses[featureId] ??
      "not_started";

    setAreaStatuses((current) => ({
      ...current,
      [featureId]: status,
    }));

    try {
      const response = await fetch(
        `/api/site-areas/${encodeURIComponent(
          featureId
        )}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The progress update could not be saved."
        );
      }
    } catch (error) {
      console.error(
        "Failed to save feature status:",
        error
      );

      setAreaStatuses(
        (current) => ({
          ...current,
          [featureId]:
            previousStatus,
        })
      );

      alert(
        error instanceof Error
          ? error.message
          : "The progress update could not be saved."
      );
    }
  }

  /*
   * CHANGE MAP VIEW
   *
   * Close any currently-open details card
   * because that feature may no longer be
   * visible in the newly selected layer.
   */
  function changeMapView(
    nextView: MapView
  ) {
    setMapView(nextView);
    setSelectedFeatureId(null);
  }

  /*
   * MAP / TRACE CLICK
   */
  function handleMapClick(
    event: MouseEvent<SVGSVGElement>
  ) {
    if (!traceMode) {
      setSelectedFeatureId(null);
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const x =
      ((event.clientX -
        rect.left) /
        rect.width) *
      MAP_WIDTH;

    const y =
      ((event.clientY -
        rect.top) /
        rect.height) *
      MAP_HEIGHT;

    setPoints((current) => [
      ...current,
      {
        x: Math.round(x),
        y: Math.round(y),
      },
    ]);
  }

  /*
   * TRACE CONTROLS
   */
  function toggleTraceMode() {
    setTraceMode((current) => {
      const next = !current;

      if (next) {
        setSelectedFeatureId(null);
      }

      return next;
    });
  }

  function changeTraceGeometry(
    geometry: TraceGeometry
  ) {
    if (
      geometry === traceGeometry
    ) {
      return;
    }

    if (
      points.length > 0 &&
      !window.confirm(
        "Switching trace type will clear the current trace. Continue?"
      )
    ) {
      return;
    }

    setPoints([]);
    setTraceGeometry(geometry);
  }

  function undoPoint() {
    setPoints((current) =>
      current.slice(0, -1)
    );
  }

  function clearPoints() {
    setPoints([]);
  }

  async function copyPoints() {
    const minimumPoints =
      traceGeometry === "line"
        ? 2
        : 3;

    if (
      points.length <
      minimumPoints
    ) {
      return;
    }

    const coordinates = points
      .map(
        (point) =>
          `${point.x},${point.y}`
      )
      .join(" ");

    try {
      await navigator.clipboard.writeText(
        coordinates
      );

      alert(
        traceGeometry === "line"
          ? "Line coordinates copied."
          : "Area coordinates copied."
      );
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
        wheel={{
          step: 0.1,
        }}
        pinch={{
          disabled: traceMode,
        }}
        doubleClick={{
          disabled: traceMode,
        }}
        panning={{
          disabled: traceMode,
        }}
      >
        {({
          zoomIn,
          zoomOut,
          resetTransform,
        }) => (
          <>
            <MapToolbar
              traceMode={
                traceMode
              }
              traceGeometry={
                traceGeometry
              }
              mapView={mapView}
              pointsCount={
                points.length
              }
              onToggleTrace={
                toggleTraceMode
              }
              onTraceGeometryChange={
                changeTraceGeometry
              }
              onMapViewChange={
                changeMapView
              }
              onUndo={
                undoPoint
              }
              onClear={
                clearPoints
              }
              onCopy={
                copyPoints
              }
              onZoomIn={
                zoomIn
              }
              onZoomOut={
                zoomOut
              }
              onReset={
                resetTransform
              }
            />

            {/*
             * Overall progress remains based
             * on the whole site regardless of
             * the current visual filter.
             */}
            <ProgressSummary
              areas={ALL_FEATURES}
              statuses={
                areaStatuses
              }
            />

            <div className="min-h-0 flex-1 overflow-hidden">
              <TransformComponent
                wrapperStyle={
                  TRANSFORM_WRAPPER_STYLE
                }
                contentStyle={
                  TRANSFORM_CONTENT_STYLE
                }
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
                    draggable={
                      false
                    }
                    loading="eager"
                    fetchPriority="high"
                    className="pointer-events-none absolute inset-0 h-full w-full select-none"
                  />

                  {/* INTERACTIVE MAP */}
                  <svg
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    className={`absolute inset-0 h-full w-full ${
                      traceMode
                        ? "cursor-crosshair"
                        : ""
                    }`}
                    onClick={
                      handleMapClick
                    }
                  >
                    {/* INFRASTRUCTURE */}
                    <InfrastructureLineLayer
                      lines={
                        visibleInfrastructureLines
                      }
                      statuses={
                        areaStatuses
                      }
                      urgentTaskCounts={
                        urgentTaskCounts
                      }
                      selectedAreaId={
                        selectedFeatureId
                      }
                      traceMode={
                        traceMode
                      }
                      onSelectArea={
                        setSelectedFeatureId
                      }
                    />

                    {/* MARQUEES / SITE AREAS */}
                    <SiteAreaLayer
                      areas={
                        visibleSiteAreas
                      }
                      statuses={
                        areaStatuses
                      }
                      urgentTaskCounts={
                        urgentTaskCounts
                      }
                      selectedAreaId={
                        selectedFeatureId
                      }
                      traceMode={
                        traceMode
                      }
                      onSelectArea={
                        setSelectedFeatureId
                      }
                    />

                    {/* TRACE PREVIEW */}
                    {(traceMode ||
                      points.length >
                        0) && (
                      <TraceLayer
                        points={
                          points
                        }
                        mode={
                          traceGeometry
                        }
                      />
                    )}
                  </svg>
                </div>
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>

      {/* FEATURE DETAILS */}
      {selectedFeature && (
        <AreaDetailsCard
          key={
            selectedFeature.id
          }
          area={
            selectedFeature
          }
          status={
            areaStatuses[
              selectedFeature.id
            ] ??
            selectedFeature.status
          }
          onStatusChange={(
            status
          ) =>
            updateAreaStatus(
              selectedFeature.id,
              status
            )
          }
          onClose={() =>
            setSelectedFeatureId(
              null
            )
          }
        />
      )}
    </div>
  );
}