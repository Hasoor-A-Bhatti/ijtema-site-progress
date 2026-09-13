import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

import type {
  TowerLightStatus,
} from "@/types/towerLights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    lightId: string;
  }>;
}

const VALID_STATUSES:
  TowerLightStatus[] = [
    "on",
    "off",
    "down",
  ];

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  const authorised =
    await hasValidEditorSession();

  if (!authorised) {
    return NextResponse.json(
      {
        error:
          "Editing access is required.",
      },
      {
        status: 401,
      }
    );
  }

  const {
    lightId,
  } =
    await context.params;

  const cleanLightId =
    lightId?.trim();

  if (!cleanLightId) {
    return NextResponse.json(
      {
        error:
          "A valid tower light is required.",
      },
      {
        status: 400,
      }
    );
  }

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !==
      "object" ||
    body === null ||
    !("status" in body)
  ) {
    return NextResponse.json(
      {
        error:
          "A valid light status is required.",
      },
      {
        status: 400,
      }
    );
  }

  const status =
    (body as {
      status?: unknown;
    }).status;

  if (
    typeof status !==
      "string" ||
    !VALID_STATUSES.includes(
      status as TowerLightStatus
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Status must be on, off or down.",
      },
      {
        status: 400,
      }
    );
  }

  const newStatus =
    status as TowerLightStatus;

  /*
   * The database RPC locks the current light row,
   * writes a timestamped history event and updates
   * the current status as one transaction.
   *
   * This avoids an operational state change ever
   * being saved without its matching history row.
   */
  const {
    data,
    error,
  } =
    await supabaseServer.rpc(
      "set_tower_light_status",
      {
        p_light_id:
          cleanLightId,
        p_new_status:
          newStatus,
      }
    );

  if (error) {
    console.error(
      "Tower light status update failed:",
      error
    );

    const message =
      error.message
        ?.toLowerCase()
        .includes(
          "not found"
        )
        ? "Tower light not found."
        : "Tower light status could not be updated.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          message ===
          "Tower light not found."
            ? 404
            : 500,
      }
    );
  }

  const transition =
    Array.isArray(data)
      ? data[0] ?? null
      : data;

  return NextResponse.json({
    success: true,
    transition,
  });
}
