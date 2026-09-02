"use client";

import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface UnlockResult {
  success: boolean;
  error?: string;
}

interface EditorAccessContextValue {
  canEdit: boolean;
  loading: boolean;
  expiresAt: number | null;

  unlock: (password: string) => Promise<UnlockResult>;
  lock: () => Promise<void>;

  /*
   * Opens the shared editing-access password prompt.
   *
   * If editing is already enabled, the callback runs
   * immediately without showing the popup.
   */
  requestEditingAccess: (onSuccess?: () => void) => void;
}

const EditorAccessContext =
  createContext<EditorAccessContextValue | null>(null);

export function EditorAccessProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  /*
   * Shared password prompt state.
   */
  const [promptOpen, setPromptOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  /*
   * Stores the action that should happen after successful
   * authentication.
   *
   * Example:
   * Clicking Site Reports can ask for editing access and,
   * once unlocked, automatically open the Reports tab.
   */
  const pendingSuccessAction = useRef<(() => void) | null>(null);

  /*
   * Restore an existing editor session when the app opens.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadEditorStatus() {
      try {
        const response = await fetch("/api/editor/status", {
          cache: "no-store",
        });

        const data = await response.json();

        if (cancelled) return;

        setCanEdit(Boolean(data.canEdit));
        setExpiresAt(data.expiresAt ?? null);
      } catch (error) {
        console.error("Failed to check editor status:", error);

        if (!cancelled) {
          setCanEdit(false);
          setExpiresAt(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEditorStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Automatically lock the visible UI when the
   * server-issued editor session expires.
   */
  useEffect(() => {
    if (!canEdit || !expiresAt) return;

    const remaining = Math.max(expiresAt - Date.now(), 0);

    const timeout = window.setTimeout(() => {
      setCanEdit(false);
      setExpiresAt(null);
    }, remaining);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [canEdit, expiresAt]);

  /*
   * Send password to the protected editor unlock API.
   */
  async function unlock(passwordToCheck: string): Promise<UnlockResult> {
    try {
      const response = await fetch("/api/editor/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: passwordToCheck,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error ?? "Editing could not be enabled.",
        };
      }

      setCanEdit(true);
      setExpiresAt(data.expiresAt ?? null);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Editor unlock request failed:", error);

      return {
        success: false,
        error: "Could not connect to the server.",
      };
    }
  }

  /*
   * Lock editing and remove the server session.
   */
  async function lock() {
    try {
      await fetch("/api/editor/lock", {
        method: "POST",
      });
    } finally {
      setCanEdit(false);
      setExpiresAt(null);

      setPromptOpen(false);
      setPassword("");
      setPromptError(null);

      pendingSuccessAction.current = null;
    }
  }

  /*
   * SHARED ACCESS REQUEST
   *
   * Any component can now request editing access.
   *
   * If already authenticated:
   * → immediately perform the requested action.
   *
   * If not authenticated:
   * → open the shared password popup.
   */
  function requestEditingAccess(onSuccess?: () => void) {
    if (canEdit) {
      onSuccess?.();
      return;
    }

    pendingSuccessAction.current = onSuccess ?? null;

    setPassword("");
    setPromptError(null);
    setPromptOpen(true);
  }

  function closePrompt() {
    if (unlocking) return;

    setPromptOpen(false);
    setPassword("");
    setPromptError(null);

    pendingSuccessAction.current = null;
  }

  /*
   * Handle password submission from the shared popup.
   */
  async function handleUnlockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanPassword = password.trim();

    if (!cleanPassword) {
      setPromptError("Enter the editing password.");
      return;
    }

    setUnlocking(true);
    setPromptError(null);

    const result = await unlock(cleanPassword);

    setUnlocking(false);

    if (!result.success) {
      setPromptError(
        result.error ?? "Editing access could not be enabled."
      );

      return;
    }

    const successAction = pendingSuccessAction.current;

    pendingSuccessAction.current = null;

    setPromptOpen(false);
    setPassword("");
    setPromptError(null);

    /*
     * Complete whatever action originally required access.
     *
     * For example:
     * Site Reports click → password → Reports automatically opens.
     */
    successAction?.();
  }

  return (
    <EditorAccessContext.Provider
      value={{
        canEdit,
        loading,
        expiresAt,
        unlock,
        lock,
        requestEditingAccess,
      }}
    >
      {children}

      {/* SHARED EDITING ACCESS MODAL */}
      {promptOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={closePrompt}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editing-access-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* HEADER */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2
                  id="editing-access-title"
                  className="text-lg font-semibold text-slate-950"
                >
                  Editing Access
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Enter the site editing password to continue.
                </p>
              </div>

              <button
                type="button"
                onClick={closePrompt}
                disabled={unlocking}
                aria-label="Close editing access"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
              >
                ×
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleUnlockSubmit}
              className="p-5"
            >
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Password
                </span>

                <input
                  type="password"
                  autoFocus
                  value={password}
                  disabled={unlocking}
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (promptError) {
                      setPromptError(null);
                    }
                  }}
                  placeholder="Enter password"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                />
              </label>

              {promptError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                  <p className="text-sm font-medium text-red-700">
                    {promptError}
                  </p>
                </div>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closePrompt}
                  disabled={unlocking}
                  className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={unlocking}
                  className="min-h-11 flex-1 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {unlocking
                    ? "Checking..."
                    : "Enable Editing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </EditorAccessContext.Provider>
  );
}

export function useEditorAccess() {
  const context = useContext(EditorAccessContext);

  if (!context) {
    throw new Error(
      "useEditorAccess must be used inside EditorAccessProvider."
    );
  }

  return context;
}