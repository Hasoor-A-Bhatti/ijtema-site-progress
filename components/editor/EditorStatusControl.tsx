"use client";

import { FormEvent, useState } from "react";

import { useEditorAccess } from "./EditorAccessProvider";

export default function EditorStatusControl() {
  const { canEdit, loading, unlock, lock } = useEditorAccess();

  const [showUnlock, setShowUnlock] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();

    if (!password.trim()) return;

    setSubmitting(true);
    setError("");

    const result = await unlock(password);

    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Incorrect password.");
      return;
    }

    setPassword("");
    setShowUnlock(false);
  }

  if (loading) {
    return (
      <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  return (
    <>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Editing Enabled
          </div>

          <button
            type="button"
            onClick={() => void lock()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Lock
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowUnlock(true)}
          className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          <span>🔒</span>
          View Only
        </button>
      )}

      {showUnlock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Enable Editing
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Enter the authorised site-team password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUnlock(false);
                  setPassword("");
                  setError("");
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUnlock} className="mt-5">
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Editing password"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-600"
              />

              {error && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !password.trim()}
                className="mt-4 min-h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {submitting ? "Checking..." : "Enable Editing"}
              </button>

              <p className="mt-3 text-center text-xs text-slate-400">
                Editing access automatically expires after 30 minutes.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}