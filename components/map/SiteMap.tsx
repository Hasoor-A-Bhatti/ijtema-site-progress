"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";

import AreaDetailsCard from "@/components/area/AreaDetailsCard";
import GeneratorDetailsCard from "@/components/generator/GeneratorDetailsCard";
import TowerLightDetailsCard from "@/components/tower-light/TowerLightDetailsCard";
import ProgressSummary from "@/components/dashboard/ProgressSummary";
import EquipmentRequirementLayer from "@/components/map/EquipmentRequirementLayer";
import GeneratorLayer from "@/components/map/GeneratorLayer";
import InfrastructureLineLayer from "@/components/map/InfrastructureLineLayer";
import MapToolbar from "@/components/map/MapToolbar";
import SiteAreaLayer from "@/components/map/SiteAreaLayer";
import TraceLayer from "@/components/map/TraceLayer";
import TowerLightLayer from "@/components/map/TowerLightLayer";
import Site3DMap from "@/components/map/three/Site3DMap";

import type { MapView } from "@/components/map/MapToolbar";

import { infrastructureLines } from "@/data/infrastructureLines";
import { siteAreas } from "@/data/siteAreas";

import useGenerators from "@/hooks/useGenerators";
import useOutstandingEquipmentCounts from "@/hooks/useOutstandingEquipmentCounts";
import useTowerLights from "@/hooks/useTowerLights";
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

type MapMode =
  | "2d"
  | "3d";

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

function grayscaleChannel(
  red: number,
  green: number,
  blue: number
) {
  return Math.round(
    red * 0.2126 +
      green * 0.7152 +
      blue * 0.0722
  );
}

function toMonochromeColor(
  input: string
) {
  const value = input.trim();
  const important = /\s*!important\s*$/i.test(value);
  const cleanValue = value.replace(
    /\s*!important\s*$/i,
    ""
  );

  if (
    cleanValue === "none" ||
    cleanValue === "transparent" ||
    cleanValue === "currentColor" ||
    cleanValue.startsWith("url(") ||
    cleanValue.startsWith("var(")
  ) {
    return input;
  }

  const hexMatch = cleanValue.match(
    /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
  );

  if (hexMatch) {
    let hex = hexMatch[1];

    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((character) =>
          character + character
        )
        .join("");
    }

    const red = parseInt(
      hex.slice(0, 2),
      16
    );
    const green = parseInt(
      hex.slice(2, 4),
      16
    );
    const blue = parseInt(
      hex.slice(4, 6),
      16
    );
    const alpha =
      hex.length === 8
        ? hex.slice(6, 8)
        : "";

    const gray = grayscaleChannel(
      red,
      green,
      blue
    );
    const grayHex = gray
      .toString(16)
      .padStart(2, "0");

    return `#${grayHex}${grayHex}${grayHex}${alpha}${
      important ? " !important" : ""
    }`;
  }

  const rgbMatch = cleanValue.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
  );

  if (rgbMatch) {
    const red = Math.max(
      0,
      Math.min(255, Number(rgbMatch[1]))
    );
    const green = Math.max(
      0,
      Math.min(255, Number(rgbMatch[2]))
    );
    const blue = Math.max(
      0,
      Math.min(255, Number(rgbMatch[3]))
    );
    const gray = grayscaleChannel(
      red,
      green,
      blue
    );
    const alpha = rgbMatch[4];

    return alpha
      ? `rgba(${gray}, ${gray}, ${gray}, ${alpha})${
          important ? " !important" : ""
        }`
      : `rgb(${gray}, ${gray}, ${gray})${
          important ? " !important" : ""
        }`;
  }

  return input;
}

function convertCssColorsToMonochrome(
  cssText: string
) {
  return cssText.replace(
    /(fill|stroke|color|stop-color|flood-color|lighting-color)\s*:\s*([^;}{]+)/gi,
    (_match, property: string, value: string) =>
      `${property}: ${toMonochromeColor(
        value
      )}`
  );
}

function makeSvgMonochrome(
  svgText: string
) {
  const parser = new DOMParser();
  const document = parser.parseFromString(
    svgText,
    "image/svg+xml"
  );

  if (document.querySelector("parsererror")) {
    throw new Error(
      "The site map SVG could not be parsed."
    );
  }

  const svg = document.documentElement;
  const colorAttributes = [
    "fill",
    "stroke",
    "color",
    "stop-color",
    "flood-color",
    "lighting-color",
  ];

  document.querySelectorAll("*").forEach(
    (element) => {
      colorAttributes.forEach(
        (attribute) => {
          const value =
            element.getAttribute(attribute);

          if (value) {
            element.setAttribute(
              attribute,
              toMonochromeColor(value)
            );
          }
        }
      );

      const inlineStyle =
        element.getAttribute("style");

      if (inlineStyle) {
        element.setAttribute(
          "style",
          convertCssColorsToMonochrome(
            inlineStyle
          )
        );
      }
    }
  );

  document
    .querySelectorAll("style")
    .forEach((styleElement) => {
      if (styleElement.textContent) {
        styleElement.textContent =
          convertCssColorsToMonochrome(
            styleElement.textContent
          );
      }
    });

  /*
   * Remove executable content from the static
   * SVG before inserting it into the page.
   */
  document
    .querySelectorAll("script")
    .forEach((script) => script.remove());

  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute(
    "preserveAspectRatio",
    "xMidYMid meet"
  );

  const existingStyle =
    svg.getAttribute("style") ?? "";

  svg.setAttribute(
    "style",
    `${existingStyle};width:100%;height:100%;display:block;`
  );

  return new XMLSerializer().serializeToString(
    svg
  );
}

export default function SiteMap() {
  const [mapMode, setMapMode] =
    useState<MapMode>("2d");

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

  const [
    monochromeMapSvg,
    setMonochromeMapSvg,
  ] = useState<string | null>(null);

  const [
    selectedGeneratorId,
    setSelectedGeneratorId,
  ] = useState<string | null>(null);

  const [
    selectedTowerLightId,
    setSelectedTowerLightId,
  ] = useState<string | null>(null);

  const urgentTaskCounts =
    useUrgentTaskCounts();

  const outstandingEquipmentCounts =
    useOutstandingEquipmentCounts();

  const {
    generators,
    refresh: refreshGenerators,
  } = useGenerators();

  const {
    lights: towerLights,
    refresh: refreshTowerLights,
  } = useTowerLights();

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

  const selectedGenerator = useMemo(
    () =>
      generators.find(
        (generator) =>
          generator.id ===
          selectedGeneratorId
      ) ?? null,
    [
      generators,
      selectedGeneratorId,
    ]
  );

  const selectedTowerLight = useMemo(
    () =>
      towerLights.find(
        (light) =>
          light.id ===
          selectedTowerLightId
      ) ?? null,
    [
      towerLights,
      selectedTowerLightId,
    ]
  );

  /*
   * FILTER POLYGON AREAS
   *
   * ALL:
   * Show every polygon site area.
   *
   * MARQUEES:
   * Show normal site areas, but hide polygon
   * areas that represent tracking.
   *
   * TRACKING:
   * Show polygon tracking areas such as Pad 1
   * and Pad 2 alongside the existing track lines.
   *
   * FENCE / GENERATORS + LIGHTS:
   * Hide polygon site-area overlays.
   */
  const visibleSiteAreas =
    useMemo(() => {
      if (mapView === "all") {
        return siteAreas;
      }

      if (mapView === "marquees") {
        return siteAreas.filter(
          (area) =>
            area.type !==
              "metal_tracking" &&
            area.type !==
              "rubber_tracking"
        );
      }

      if (mapView === "tracking") {
        return siteAreas.filter(
          (area) =>
            area.type ===
              "metal_tracking" ||
            area.type ===
              "rubber_tracking"
        );
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
   * LOAD THE ORIGINAL VECTOR MAP AND CONVERT
   * ITS COLOURS DIRECTLY INSIDE THE SVG.
   *
   * This deliberately avoids CSS filters such
   * as grayscale / contrast / brightness. Those
   * filters can cause the browser to rasterise the
   * SVG before react-zoom-pan-pinch scales it, which
   * makes small labels look soft or blurred.
   *
   * Converting the actual SVG colour values keeps
   * text and linework as vector content at every zoom.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadMonochromeMap() {
      try {
        const response = await fetch(
          "/maps/site-map.svg",
          { cache: "force-cache" }
        );

        if (!response.ok) {
          throw new Error(
            "The site map could not be loaded."
          );
        }

        const svgText =
          await response.text();
        const monochromeSvg =
          makeSvgMonochrome(svgText);

        if (!cancelled) {
          setMonochromeMapSvg(
            monochromeSvg
          );
        }
      } catch (error) {
        console.error(
          "Failed to create monochrome site map:",
          error
        );
      }
    }

    void loadMonochromeMap();

    return () => {
      cancelled = true;
    };
  }, []);

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
   * 2D / 3D MODE
   *
   * Tracing belongs to the flat 2D SVG map. Entering
   * 3D therefore exits trace mode and clears any
   * unfinished trace points.
   */
  function changeMapMode(
    nextMode: MapMode
  ) {
    if (nextMode === mapMode) {
      return;
    }

    setMapMode(nextMode);

    if (nextMode === "3d") {
      setTraceMode(false);
      setPoints([]);
      setSelectedTowerLightId(null);
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
    setSelectedGeneratorId(null);
    setSelectedTowerLightId(null);
  }

  /*
   * MAP / TRACE CLICK
   */
  function handleMapClick(
    event: MouseEvent<SVGSVGElement>
  ) {
    if (!traceMode) {
      setSelectedFeatureId(null);
      setSelectedGeneratorId(null);
      setSelectedTowerLightId(null);
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
        setSelectedGeneratorId(null);
        setSelectedTowerLightId(null);
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
      {mapMode === "2d" ? (
        <TransformWrapper
          minScale={0.8}
          maxScale={8}
          initialScale={1.45}
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
                mapMode={mapMode}
                onMapModeChange={
                  changeMapMode
                }
                traceMode={traceMode}
                traceGeometry={traceGeometry}
                mapView={mapView}
                pointsCount={points.length}
                onToggleTrace={toggleTraceMode}
                onTraceGeometryChange={
                  changeTraceGeometry
                }
                onMapViewChange={changeMapView}
                onUndo={undoPoint}
                onClear={clearPoints}
                onCopy={copyPoints}
                onZoomIn={() =>
                  zoomIn(0.28, 180)
                }
                onZoomOut={() =>
                  zoomOut(0.28, 180)
                }
                onReset={() =>
                  resetTransform(220)
                }
              />

              <ProgressSummary
                areas={ALL_FEATURES}
                statuses={areaStatuses}
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
                    {monochromeMapSvg ? (
                      <div
                        role="img"
                        aria-label="National Ijtema 2026 site plan"
                        className="pointer-events-none absolute inset-0 h-full w-full select-none overflow-hidden"
                        dangerouslySetInnerHTML={{
                          __html: monochromeMapSvg,
                        }}
                      />
                    ) : (
                      <img
                        src="/maps/site-map.svg"
                        alt="National Ijtema 2026 site plan"
                        draggable={false}
                        loading="eager"
                        fetchPriority="high"
                        className="pointer-events-none absolute inset-0 h-full w-full select-none"
                      />
                    )}

                    <svg
                      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                      className={`absolute inset-0 h-full w-full ${
                        traceMode
                          ? "cursor-crosshair"
                          : ""
                      }`}
                      onClick={handleMapClick}
                    >
                      <InfrastructureLineLayer
                        lines={
                          visibleInfrastructureLines
                        }
                        statuses={areaStatuses}
                        urgentTaskCounts={
                          urgentTaskCounts
                        }
                        selectedAreaId={
                          selectedFeatureId
                        }
                        traceMode={traceMode}
                        onSelectArea={(
                          featureId
                        ) => {
                          setSelectedGeneratorId(
                            null
                          );
                          setSelectedTowerLightId(
                            null
                          );
                          setSelectedFeatureId(
                            featureId
                          );
                        }}
                      />

                      <SiteAreaLayer
                        areas={visibleSiteAreas}
                        statuses={areaStatuses}
                        urgentTaskCounts={
                          urgentTaskCounts
                        }
                        selectedAreaId={
                          selectedFeatureId
                        }
                        traceMode={traceMode}
                        onSelectArea={(
                          featureId
                        ) => {
                          setSelectedGeneratorId(
                            null
                          );
                          setSelectedTowerLightId(
                            null
                          );
                          setSelectedFeatureId(
                            featureId
                          );
                        }}
                      />

                      <EquipmentRequirementLayer
                        areas={visibleSiteAreas}
                        outstandingCounts={
                          outstandingEquipmentCounts
                        }
                        urgentTaskCounts={
                          urgentTaskCounts
                        }
                        selectedAreaId={
                          selectedFeatureId
                        }
                        traceMode={traceMode}
                        onSelectArea={(
                          featureId
                        ) => {
                          setSelectedGeneratorId(
                            null
                          );
                          setSelectedTowerLightId(
                            null
                          );
                          setSelectedFeatureId(
                            featureId
                          );
                        }}
                      />

                      {(mapView === "all" ||
                        mapView === "power") && (
                        <GeneratorLayer
                          generators={generators}
                          selectedGeneratorId={
                            selectedGeneratorId
                          }
                          traceMode={traceMode}
                          onSelectGenerator={(
                            generatorId
                          ) => {
                            setSelectedFeatureId(
                              null
                            );
                            setSelectedTowerLightId(
                              null
                            );
                            setSelectedGeneratorId(
                              generatorId
                            );
                          }}
                        />
                      )}

                      {(mapView === "all" ||
                        mapView === "power") && (
                        <TowerLightLayer
                          lights={towerLights}
                          selectedLightId={
                            selectedTowerLightId
                          }
                          traceMode={traceMode}
                          onSelectLight={(
                            lightId
                          ) => {
                            setSelectedFeatureId(
                              null
                            );
                            setSelectedGeneratorId(
                              null
                            );
                            setSelectedTowerLightId(
                              lightId
                            );
                          }}
                        />
                      )}

                      {(traceMode ||
                        points.length > 0) && (
                        <TraceLayer
                          points={points}
                          mode={traceGeometry}
                        />
                      )}
                    </svg>
                  </div>
                </TransformComponent>
              </div>
            </>
          )}
        </TransformWrapper>
      ) : (
        <>
          <MapToolbar
            mapMode={mapMode}
            onMapModeChange={
              changeMapMode
            }
          />

          <ProgressSummary
            areas={ALL_FEATURES}
            statuses={areaStatuses}
          />

          <div className="min-h-0 flex-1 overflow-hidden">
            <Site3DMap
              statuses={areaStatuses}
              urgentTaskCounts={
                urgentTaskCounts
              }
              generators={generators}
              lights={towerLights}
              selectedAreaId={
                selectedFeatureId
              }
              selectedGeneratorId={
                selectedGeneratorId
              }
              selectedLightId={
                selectedTowerLightId
              }
              onSelectArea={(
                featureId
              ) => {
                setSelectedGeneratorId(
                  null
                );
                setSelectedTowerLightId(
                  null
                );
                setSelectedFeatureId(
                  featureId
                );
              }}
              onSelectGenerator={(
                generatorId
              ) => {
                setSelectedFeatureId(
                  null
                );
                setSelectedTowerLightId(
                  null
                );
                setSelectedGeneratorId(
                  generatorId
                );
              }}
              onSelectLight={(
                lightId
              ) => {
                setSelectedFeatureId(
                  null
                );
                setSelectedGeneratorId(
                  null
                );
                setSelectedTowerLightId(
                  lightId
                );
              }}
            />
          </div>
        </>
      )}

      {selectedFeature && (
        <AreaDetailsCard
          key={selectedFeature.id}
          area={selectedFeature}
          status={
            areaStatuses[
              selectedFeature.id
            ] ??
            selectedFeature.status
          }
          onStatusChange={(status) =>
            updateAreaStatus(
              selectedFeature.id,
              status
            )
          }
          onClose={() =>
            setSelectedFeatureId(null)
          }
        />
      )}

      {selectedGenerator && (
        <GeneratorDetailsCard
          key={selectedGenerator.id}
          generator={selectedGenerator}
          onChanged={refreshGenerators}
          onClose={() =>
            setSelectedGeneratorId(null)
          }
        />
      )}

      {selectedTowerLight && (
        <TowerLightDetailsCard
          key={selectedTowerLight.id}
          light={selectedTowerLight}
          onChanged={refreshTowerLights}
          onClose={() =>
            setSelectedTowerLightId(null)
          }
        />
      )}
    </div>
  );
}