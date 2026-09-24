"use client";

export type MapView =
  | "all"
  | "marquees"
  | "tracking"
  | "fence"
  | "power"
  | "amoomi";

export type TraceGeometry =
  | "area"
  | "line";

export type MapMode =
  | "2d"
  | "3d";

export type SceneMode =
  | "day"
  | "night";

interface MapToolbarProps {
  mapMode: MapMode;
  onMapModeChange:
    (mode: MapMode) =>
      void;

  sceneMode?: SceneMode;
  onSceneModeChange?:
    (mode: SceneMode) =>
      void;

  amoomiAuthorised?: boolean;
  onAmoomiLock?: () => void;

  traceMode?: boolean;
  traceGeometry?:
    TraceGeometry;
  mapView?: MapView;
  pointsCount?: number;

  onToggleTrace?:
    () => void;
  onTraceGeometryChange?:
    (
      geometry:
        TraceGeometry
    ) => void;
  onMapViewChange?:
    (
      view:
        MapView
    ) => void;
  onUndo?:
    () => void;
  onClear?:
    () => void;
  onCopy?:
    () => void;
  onZoomIn?:
    () => void;
  onZoomOut?:
    () => void;
  onReset?:
    () => void;
}

interface ViewOption {
  value: MapView;
  label: string;
  activeClass: string;
}

const VIEW_OPTIONS:
  ViewOption[] = [
    {
      value: "all",
      label: "All",
      activeClass:
        "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200",
    },
    {
      value: "marquees",
      label: "Marquees",
      activeClass:
        "bg-emerald-500 text-white shadow-sm",
    },
    {
      value: "tracking",
      label: "Tracking",
      activeClass:
        "bg-orange-500 text-white shadow-sm",
    },
    {
      value: "fence",
      label: "Fence",
      activeClass:
        "bg-violet-500 text-white shadow-sm",
    },
    {
      value: "power",
      label:
        "Generators / Lights",
      activeClass:
        "bg-gradient-to-r from-red-600 to-amber-400 text-white shadow-sm",
    },
    {
      value: "amoomi",
      label: "Amoomi",
      activeClass:
        "bg-slate-950 text-amber-300 shadow-sm ring-1 ring-amber-400",
    },
  ];

function FilterButton({
  option,
  active,
  onClick,
  locked = false,
}: {
  option:
    ViewOption;
  active:
    boolean;
  onClick:
    () => void;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      aria-pressed={
        active
      }
      className={`min-h-10 shrink-0 snap-start rounded-xl px-3 text-xs font-semibold transition sm:min-h-12 sm:px-5 sm:text-sm ${
        active
          ? option.activeClass
          : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {
          option.label
        }

        {locked && (
          <span
            aria-hidden="true"
            className="text-[11px]"
          >
            🔒
          </span>
        )}
      </span>
    </button>
  );
}

function MapModeControl({
  mapMode,
  onMapModeChange,
}: {
  mapMode: MapMode;
  onMapModeChange:
    (mode: MapMode) =>
      void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
      <button
        type="button"
        onClick={() =>
          onMapModeChange(
            "2d"
          )
        }
        aria-pressed={
          mapMode === "2d"
        }
        className={`h-9 rounded-lg px-2 text-[11px] font-semibold transition sm:h-10 sm:px-4 sm:text-sm ${
          mapMode === "2d"
            ? "bg-white text-slate-950 shadow-sm"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        2D Map
      </button>

      <button
        type="button"
        onClick={() =>
          onMapModeChange(
            "3d"
          )
        }
        aria-pressed={
          mapMode === "3d"
        }
        className={`h-9 rounded-lg px-2 text-[11px] font-semibold transition sm:h-10 sm:px-4 sm:text-sm ${
          mapMode === "3d"
            ? "bg-slate-950 text-white shadow-sm"
            : "text-slate-500 hover:text-slate-800"
        }`}
      >
        3D View
      </button>
    </div>
  );
}

export default function MapToolbar({
  mapMode,
  onMapModeChange,

  sceneMode = "day",
  onSceneModeChange,

  amoomiAuthorised = false,
  onAmoomiLock,

  traceMode = false,
  traceGeometry = "area",
  mapView = "all",
  pointsCount = 0,

  onToggleTrace,
  onTraceGeometryChange,
  onMapViewChange,
  onUndo,
  onClear,
  onCopy,
  onZoomIn,
  onZoomOut,
  onReset,
}: MapToolbarProps) {
  const is2D =
    mapMode === "2d";

  return (
    <div className="z-30 shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 lg:gap-3">
        {is2D ? (
          <>
            {/* LEFT: ZOOM CONTROLS */}
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={() =>
                  onZoomOut?.()
                }
                disabled={
                  !onZoomOut
                }
                aria-label="Zoom out"
                title="Zoom out"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12 sm:text-xl"
              >
                −
              </button>

              <button
                type="button"
                onClick={() =>
                  onZoomIn?.()
                }
                disabled={
                  !onZoomIn
                }
                aria-label="Zoom in"
                title="Zoom in"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:w-12 sm:text-xl"
              >
                +
              </button>

              <button
                type="button"
                onClick={() =>
                  onReset?.()
                }
                disabled={
                  !onReset
                }
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:px-4 sm:text-sm"
              >
                Reset
              </button>

            </div>

            {/* CENTRE: MAP FILTERS */}
            <div className="w-[70%] min-w-0 lg:w-auto lg:flex-1">
              <div className="w-full overflow-x-auto rounded-2xl bg-slate-100 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max snap-x snap-mandatory items-center gap-1">
                  {VIEW_OPTIONS.map(
                    (
                      option
                    ) => (
                      <FilterButton
                        key={
                          option.value
                        }
                        option={
                          option
                        }
                        active={
                          mapView ===
                          option.value
                        }
                        onClick={() =>
                          onMapViewChange?.(
                            option.value
                          )
                        }
                        locked={
                          option.value ===
                            "amoomi" &&
                          !amoomiAuthorised
                        }
                      />
                    )
                  )}

                  {amoomiAuthorised &&
                    onAmoomiLock && (
                    <button
                      type="button"
                      onClick={
                        onAmoomiLock
                      }
                      className="min-h-10 shrink-0 snap-start rounded-xl border border-amber-400 bg-slate-950 px-3 text-xs font-semibold text-amber-300 shadow-sm transition hover:bg-black sm:min-h-12 sm:px-4 sm:text-sm"
                      title="Sign out and lock Amoomi"
                    >
                      Lock Amoomi
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* MOBILE: ONLY 2D / 3D TOGGLE */}
            <div className="flex w-[20%] shrink-0 justify-end lg:hidden">
              <MapModeControl
                mapMode={
                  mapMode
                }
                onMapModeChange={
                  onMapModeChange
                }
              />
            </div>

            {/* RIGHT: DESKTOP TRACE / DRAWING CONTROLS */}
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              {traceMode && (
                <div className="col-span-2 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      onTraceGeometryChange?.(
                        "area"
                      )
                    }
                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
                      traceGeometry ===
                      "area"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Area
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onTraceGeometryChange?.(
                        "line"
                      )
                    }
                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition ${
                      traceGeometry ===
                      "line"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Line
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={
                  onToggleTrace
                }
                disabled={
                  !onToggleTrace
                }
                className={`h-12 rounded-xl px-5 text-sm font-medium shadow-sm transition ${
                  traceMode
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                {traceMode
                  ? "Finish"
                  : "Trace"}
              </button>

              <button
                type="button"
                onClick={
                  onUndo
                }
                disabled={
                  !onUndo ||
                  pointsCount === 0
                }
                className="hidden h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:block"
              >
                Undo
              </button>

              <button
                type="button"
                onClick={
                  onClear
                }
                disabled={
                  !onClear ||
                  pointsCount === 0
                }
                className="hidden h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 sm:block"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={
                  onCopy
                }
                disabled={
                  !onCopy ||
                  pointsCount === 0
                }
                className="hidden h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 md:block"
              >
                Copy{" "}
                {traceGeometry ===
                "line"
                  ? "Line"
                  : "Area"}
              </button>

              <MapModeControl
                mapMode={
                  mapMode
                }
                onMapModeChange={
                  onMapModeChange
                }
              />
            </div>
          </>
        ) : (
          <>
            {/* 3D TOOLBAR */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800">
                3D Site View
              </div>

              <div className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                Use the Rotate / Move control on the map to navigate the site.
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
              <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm lg:flex-none">
                <button
                  type="button"
                  onClick={() =>
                    onSceneModeChange?.(
                      "day"
                    )
                  }
                  aria-pressed={
                    sceneMode ===
                    "day"
                  }
                  className={`h-10 rounded-lg px-4 text-sm font-semibold transition ${
                    sceneMode ===
                    "day"
                      ? "bg-amber-100 text-amber-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ☀ Day
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onSceneModeChange?.(
                      "night"
                    )
                  }
                  aria-pressed={
                    sceneMode ===
                    "night"
                  }
                  className={`h-10 rounded-lg px-4 text-sm font-semibold transition ${
                    sceneMode ===
                    "night"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ◐ Night
                </button>
              </div>

              <MapModeControl
                mapMode={
                  mapMode
                }
                onMapModeChange={
                  onMapModeChange
                }
              />
            </div>
          </>
        )}
      </div>

    </div>
  );
}
