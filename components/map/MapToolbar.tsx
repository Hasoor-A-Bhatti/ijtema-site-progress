interface MapToolbarProps {
  traceMode: boolean;
  pointsCount: number;

  onToggleTrace: () => void;
  onUndo: () => void;
  onClear: () => void;
  onCopy: () => void;

  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export default function MapToolbar({
  traceMode,
  pointsCount,
  onToggleTrace,
  onUndo,
  onClear,
  onCopy,
  onZoomIn,
  onZoomOut,
  onReset,
}: MapToolbarProps) {
  const buttonBase =
    "flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 active:bg-slate-100";

  return (
    <div className="flex items-center gap-2 border-b bg-white px-3 py-2">
      {/* MAP CONTROLS */}
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

      {/* DESKTOP TRACE CONTROLS */}
      <div className="hidden items-center gap-2 md:flex">
        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          onClick={onToggleTrace}
          className={`h-11 rounded-lg px-4 text-sm font-medium text-white transition ${
            traceMode
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {traceMode ? "Tracing Enabled" : "Trace Area"}
        </button>

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
          disabled={pointsCount < 3}
          className={`${buttonBase} h-11 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Copy Coordinates
        </button>
      </div>

      {/* DESKTOP HELP TEXT */}
      <div className="ml-auto hidden text-sm text-slate-500 lg:block">
        {traceMode
          ? `${pointsCount} points selected`
          : "Zoom and drag around the site"}
      </div>
    </div>
  );
}