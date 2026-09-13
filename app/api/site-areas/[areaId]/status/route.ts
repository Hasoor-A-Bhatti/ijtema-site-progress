import { NextResponse } from "next/server";

import { getStatusOrder } from "@/config/statuses";
import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

import type { AreaType, SiteStatus } from "@/types/site";

interface RouteContext {
  params: Promise<{
    areaId: string;
  }>;
}

const VALID_STATUSES: SiteStatus[] = [
  "not_started",
  "marked",
  "construction_started",
  "construction_completed",
  "carpeting_completed",
  "electrical_installation_completed",
  "track_laid",
  "fence_erected",
  "fence_secured",
  "fence_covered",
  "ready_for_inspection",
  "signed_off",
];

function isInfrastructureType(areaType: string) {
  return (
    areaType === "fence" ||
    areaType === "rubber_tracking" ||
    areaType === "metal_tracking"
  );
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  /* 1. AUTHORISATION */
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

  /* 2. READ REQUEST */
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

  /* 3. LOAD FEATURE */
  const { data: area, error: areaError } = await supabaseServer
    .from("site_areas")
    .select("id, name, area_type, status")
    .eq("id", cleanAreaId)
    .maybeSingle();

  if (areaError) {
    console.error("Failed to retrieve site area:", areaError);

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

  const areaType = area.area_type as AreaType;
  const allowedStatuses = getStatusOrder(areaType);
  const isInfrastructure = isInfrastructureType(area.area_type);

  /* 4. ENFORCE TYPE-SPECIFIC WORKFLOW */
  if (!allowedStatuses.includes(newStatus)) {
    const workflowName =
      area.area_type === "fence"
        ? "fence"
        : area.area_type === "metal_tracking" ||
            area.area_type === "rubber_tracking"
          ? "tracking"
          : "marquee / site area";

    return NextResponse.json(
      {
        error: `That progress stage is not valid for this ${workflowName} workflow.`,
      },
      { status: 400 }
    );
  }

  /*
   * 5. READY FOR INSPECTION / SIGNED OFF
   *    CANNOT HAVE UNRESOLVED URGENT ISSUES
   */
  if (
    newStatus === "ready_for_inspection" ||
    newStatus === "signed_off"
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
      console.error("Failed to check urgent tasks:", urgentError);

      return NextResponse.json(
        {
          error:
            "Urgent issues could not be checked before updating progress.",
        },
        { status: 500 }
      );
    }

    if ((unresolvedUrgentCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            newStatus === "signed_off"
              ? "This area cannot be Signed Off while urgent issues remain unresolved."
              : "This area cannot be marked Ready for Inspection while urgent issues remain unresolved.",
        },
        { status: 409 }
      );
    }
  }

  /*
   * 6. EQUIPMENT DOES NOT BLOCK SIGN-OFF
   *
   * Outstanding equipment requirements are tracked
   * independently from marquee progress.
   *
   * A marquee may therefore be Signed Off while its
   * blue EQ indicator remains visible on the map.
   * The EQ indicator disappears automatically only
   * when all recorded equipment requirements are
   * fully received and confirmed.
   */

  /* 7. UPDATE STATUS */
  const { data: updatedArea, error: updateError } =
    await supabaseServer
      .from("site_areas")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanAreaId)
      .select("id, name, area_type, status, updated_at")
      .single();

  if (updateError) {
    console.error(
      "Failed to update site area status:",
      updateError
    );

    return NextResponse.json(
      {
        error: "The progress update could not be saved.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    area: updatedArea,
  });
}
