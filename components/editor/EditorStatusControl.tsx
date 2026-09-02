"use client";

import { useEditorAccess } from "./EditorAccessProvider";

export default function EditorStatusControl() {
  const {
    canEdit,
    loading,
    lock,
    requestEditingAccess,
  } = useEditorAccess();

  if (loading) {
    return (
      <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  if (canEdit) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500" />

          <span className="hidden sm:inline">
            Editing Enabled
          </span>

          <span className="sm:hidden">
            Editing
          </span>
        </div>

        <button
          type="button"
          onClick={() => void lock()}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
        >
          Lock
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => requestEditingAccess()}
      className="flex min-h-10 items-center gap-2 rounded-full bg-slate-100 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200 active:bg-slate-300"
    >
      {/* LOCK ICON */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect
          x="5"
          y="10"
          width="14"
          height="10"
          rx="2"
        />

        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>

      <span className="hidden sm:inline">
        View Only
      </span>
    </button>
  );
}