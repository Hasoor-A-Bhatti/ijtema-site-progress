export type MapView =
  | "all"
  | "marquees"
  | "tracking"
  | "fence";

type TraceGeometry = "area" | "line";

interface MapToolbarProps {
  traceMode: boolean;
  traceGeometry: TraceGeometry;
  mapView: MapView;
  pointsCount: number;

  onToggleTrace: () => void;
  onTraceGeometryChange: (geometry: TraceGeometry) => void;
  onMapViewChange: (view: MapView) => void;

  onUndo: () => void;
  onClear: () => void;
  onCopy: () => void;

  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const MAP_VIEWS: Array<{
  value: MapView;
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "marquees",
    label: "Marquees",
  },
  {
    value: "tracking",
    label: "Tracking",
  },
  {
    value: "fence",
    label: "Fence",
  },
];

export default function MapToolbar({
  traceMode,
  traceGeometry,
  mapView,
  pointsCount,
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
  const canCopy =
    traceGeometry === "line"
      ? pointsCount >= 2
      : pointsCount >= 3;

  const buttonBase =
    "flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 active:bg-slate-100";

  return (
    <div className="grid gap-2 border-b bg-white px-3 py-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      {/* ZOOM CONTROLS */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className={`${buttonBase} h-11 w-11 text-xl font-medium`}
        >
          +
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className={`${buttonBase} h-11 w-11 text-xl font-medium`}
        >
          −
        </button>

        <button
          type="button"
          onClick={onReset}
          className={`${buttonBase} h-11 px-3 text-sm font-medium`}
        >
          Reset
        </button>
      </div>

      {/* MAP VIEW FILTER */}
      <div className="flex min-w-0 justify-center">
        <div className="grid w-full max-w-[430px] grid-cols-4 rounded-xl bg-slate-100 p-1">
          {MAP_VIEWS.map((view) => {
            const active = mapView === view.value;

            return (
              <button
                key={view.value}
                type="button"
                aria-pressed={active}
                onClick={() => onMapViewChange(view.value)}
                className={`min-h-11 rounded-lg px-2 text-xs font-medium transition sm:text-sm ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP TRACE CONTROLS */}
      <div className="hidden items-center justify-end gap-2 md:flex">
        <button
          type="button"
          onClick={onToggleTrace}
          className={`h-11 rounded-lg px-4 text-sm font-medium text-white transition ${
            traceMode
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {traceMode ? "Stop Tracing" : "Trace"}
        </button>

        {traceMode && (
          <div className="flex h-11 items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onTraceGeometryChange("area")}
              className={`h-9 rounded-md px-3 text-sm font-medium transition ${
                traceGeometry === "area"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Area
            </button>

            <button
              type="button"
              onClick={() => onTraceGeometryChange("line")}
              className={`h-9 rounded-md px-3 text-sm font-medium transition ${
                traceGeometry === "line"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Line
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onUndo}
          disabled={pointsCount === 0}
          className={`${buttonBase} h-11 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Undo
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={pointsCount === 0}
          className={`${buttonBase} h-11 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Clear
        </button>

        <button
          type="button"
          onClick={onCopy}
          disabled={!canCopy}
          className={`${buttonBase} h-11 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {traceGeometry === "line"
            ? "Copy Line"
            : "Copy Area"}
        </button>
      </div>
    </div>
  );
}