"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  GeneratorListResponse,
  SiteGenerator,
} from "@/types/generators";

const EMPTY_FLEET = {
  totalGenerators: 0,
  totalKva: 0,
  totalFuelLitres: 0,
};

export default function useGenerators() {
  const [generators, setGenerators] = useState<SiteGenerator[]>([]);
  const [fleet, setFleet] = useState(EMPTY_FLEET);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch("/api/generators", {
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as
        | GeneratorListResponse
        | { error?: string }
        | null;

      if (!response.ok || !body || !("success" in body)) {
        throw new Error(
          body && "error" in body && body.error
            ? body.error
            : "Generator information could not be loaded."
        );
      }

      setGenerators(body.generators);
      setFleet(body.fleet);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Generator information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refresh]);

  return {
    generators,
    fleet,
    loading,
    error,
    refresh,
  };
}
