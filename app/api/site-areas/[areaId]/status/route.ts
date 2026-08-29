import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

import type { SiteStatus } from "@/types/site";

interface RouteContext {
  params: Promise<{
    areaId: string;
  }>;
}

const VALID_STATUSES: SiteStatus[] = [
  "not_started",
  "laid",
  "preparing",
  "ready_for_inspection",
  "completed",
];

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  /*
   * 1. AUTHORISATION
   */
  const authorised = await hasValidEditorSession();

  if (!authorised) {
    return NextResponse.json(
      { error: "Editing access is required." },
      { status: 401 }
    );
  }

  const { areaId } = await context.params;

  if (!areaId?.trim()) {
    return NextResponse.json(
      { error: "A valid site area is required." },
      { status: 400 }
    );
  }

  const cleanAreaId = areaId.trim();

  /*
   * 2. READ + VALIDATE REQUEST
   */
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body)
  ) {
    return NextResponse.json(
      { error: "A valid progress status is required." },
      { status: 400 }
    );
  }

  const status = (body as { status?: unknown }).status;

  if (
    typeof status !== "string" ||
    !VALID_STATUSES.includes(status as SiteStatus)
  ) {
    return NextResponse.json(
      { error: "A valid progress status is required." },
      { status: 400 }
    );
  }

  const newStatus = status as SiteStatus;

  /*
   * 3. MAKE SURE FEATURE EXISTS
   *
   * We also retrieve area_type so infrastructure can
   * follow its own four-stage progress workflow.
   */
  const {
    data: area,
    error: areaError,
  } = await supabaseServer
    .from("site_areas")
    .select("id, name, area_type, status")
    .eq("id", cleanAreaId)
    .maybeSingle();

  if (areaError) {
    console.error(
      "Failed to retrieve site area:",
      areaError
    );

    return NextResponse.json(
      { error: "The site area could not be checked." },
      { status: 500 }
    );
  }

  if (!area) {
    return NextResponse.json(
      { error: "Site area not found." },
      { status: 404 }
    );
  }

  /*
   * 4. DETERMINE WHETHER THIS IS INFRASTRUCTURE
   */
  const isInfrastructure =
    area.area_type === "fence" ||
    area.area_type === "rubber_tracking" ||
    area.area_type === "metal_tracking";

  /*
   * Infrastructure has no "Being Prepared" stage.
   *
   * Its workflow is:
   *
   * Not Started
   * → Tracking Laid / Fence Installed
   * → Ready for Inspection
   * → Fully Completed
   *
   * This is enforced server-side as well as hidden
   * from the UI.
   */
  if (
    isInfrastructure &&
    newStatus === "preparing"
  ) {
    return NextResponse.json(
      {
        error:
          "Infrastructure does not use the Being Prepared stage.",
      },
      { status: 400 }
    );
  }

  /*
   * 5. BLUE / GREEN CANNOT HAVE AN
   *    UNRESOLVED URGENT ISSUE
   */
  if (
    newStatus === "ready_for_inspection" ||
    newStatus === "completed"
  ) {
    const {
      count: unresolvedUrgentCount,
      error: urgentError,
    } = await supabaseServer
      .from("urgent_tasks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("area_id", cleanAreaId)
      .eq("completed", false);

    if (urgentError) {
      console.error(
        "Failed to check urgent tasks:",
        urgentError
      );

      return NextResponse.json(
        {
          error:
            "Urgent issues could not be checked before updating progress.",
        },
        { status: 500 }
      );
    }

    if (
      (unresolvedUrgentCount ?? 0) > 0
    ) {
      return NextResponse.json(
        {
          error:
            newStatus === "completed"
              ? "This area cannot be marked Fully Completed while urgent issues remain unresolved."
              : "This area cannot be marked Ready for Inspection while urgent issues remain unresolved.",
        },
        { status: 409 }
      );
    }
  }

  /*
   * 6. GREEN EQUIPMENT CHECK
   *
   * Normal site areas must have every recorded
   * equipment requirement physically received AND
   * manually confirmed before reaching Green.
   *
   * Infrastructure has no equipment workflow, so
   * this check is skipped completely for lines.
   */
  if (
    newStatus === "completed" &&
    !isInfrastructure
  ) {
    const {
      data: equipmentRequirements,
      error: equipmentError,
    } = await supabaseServer
      .from("equipment_requirements")
      .select(
        "id, quantity_required, quantity_received, completed"
      )
      .eq("area_id", cleanAreaId);

    if (equipmentError) {
      console.error(
        "Failed to check equipment requirements:",
        equipmentError
      );

      return NextResponse.json(
        {
          error:
            "Equipment requirements could not be checked before updating progress.",
        },
        { status: 500 }
      );
    }

    const incompleteEquipment =
      equipmentRequirements?.filter(
        (item) =>
          item.quantity_received <
            item.quantity_required ||
          !item.completed
      ) ?? [];

    if (incompleteEquipment.length > 0) {
      return NextResponse.json(
        {
          error:
            "This area cannot be marked Fully Completed until all equipment requirements have been received and confirmed.",
        },
        { status: 409 }
      );
    }
  }

  /*
   * 7. UPDATE STATUS
   */
  const {
    data: updatedArea,
    error: updateError,
  } = await supabaseServer
    .from("site_areas")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cleanAreaId)
    .select(
      "id, name, area_type, status, updated_at"
    )
    .single();

  if (updateError) {
    console.error(
      "Failed to update site area status:",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "The progress update could not be saved.",
      },
      { status: 500 }
    );
  }

  /*
   * 8. SUCCESS
   */
  return NextResponse.json({
    success: true,
    area: updatedArea,
  });
}