"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
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
        if (!cancelled) setLoading(false);
      }
    }

    void loadEditorStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Automatically lock the visible UI when the session expires.
   */
/*
 * Automatically lock the visible UI when the session expires.
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

  async function unlock(password: string): Promise<UnlockResult> {
    try {
      const response = await fetch("/api/editor/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error ?? "Editing could not be enabled.",
        };
      }

      setCanEdit(true);
      setExpiresAt(data.expiresAt);

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

  async function lock() {
    try {
      await fetch("/api/editor/lock", {
        method: "POST",
      });
    } finally {
      setCanEdit(false);
      setExpiresAt(null);
    }
  }

  return (
    <EditorAccessContext.Provider
      value={{
        canEdit,
        loading,
        expiresAt,
        unlock,
        lock,
      }}
    >
      {children}
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