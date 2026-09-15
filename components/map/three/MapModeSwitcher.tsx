"use client";

interface MapModeSwitcherProps {
  mode: "2d" | "3d";
  onChange: (
    mode: "2d" | "3d"
  ) => void;
}

export default function MapModeSwitcher({
  mode,
  onChange,
}: MapModeSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() =>
          onChange("2d")
        }
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          mode === "2d"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        2D Map
      </button>

      <button
        type="button"
        onClick={() =>
          onChange("3d")
        }
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          mode === "3d"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        3D View
      </button>
    </div>
  );
}
