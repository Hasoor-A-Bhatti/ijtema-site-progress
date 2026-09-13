import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

import type {
  SiteTowerLight,
  TowerLightStatusHistoryEntry,
} from "@/types/towerLights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TowerLightRow {
  id: string;
  name: string;
  x: number | string;
  y: number | string;
  status: "on" | "off" | "down";
  created_at: string;
  updated_at: string;
}

export async function GET() {
  const {
    data: lightRows,
    error: lightError,
  } = await supabaseServer
    .from("tower_lights")
    .select(
      "id, name, x, y, status, created_at, updated_at"
    )
    .order("id", {
      ascending: true,
    });

  if (lightError) {
    console.error(
      "Failed to load tower lights:",
      lightError
    );

    return NextResponse.json(
      {
        error:
          "Tower lights could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  const lights =
    (lightRows ?? []) as TowerLightRow[];

  const lightIds =
    lights.map(
      (light) => light.id
    );

  let history:
    TowerLightStatusHistoryEntry[] =
      [];

  if (lightIds.length > 0) {
    const {
      data: historyRows,
      error: historyError,
    } = await supabaseServer
      .from(
        "tower_light_status_history"
      )
      .select(
        "id, tower_light_id, old_status, new_status, changed_at"
      )
      .in(
        "tower_light_id",
        lightIds
      )
      .order(
        "changed_at",
        {
          ascending: false,
        }
      );

    if (historyError) {
      console.error(
        "Failed to load tower light status history:",
        historyError
      );

      return NextResponse.json(
        {
          error:
            "Tower light history could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    history =
      (historyRows ??
        []) as TowerLightStatusHistoryEntry[];
  }

  const historyByLight =
    new Map<
      string,
      TowerLightStatusHistoryEntry[]
    >();

  history.forEach(
    (entry) => {
      const current =
        historyByLight.get(
          entry.tower_light_id
        ) ?? [];

      current.push(entry);

      historyByLight.set(
        entry.tower_light_id,
        current
      );
    }
  );

  const result:
    SiteTowerLight[] =
      lights.map(
        (light) => ({
          ...light,
          status_history:
            historyByLight.get(
              light.id
            ) ?? [],
        })
      );

  return NextResponse.json({
    success: true,
    lights: result,
  });
}
