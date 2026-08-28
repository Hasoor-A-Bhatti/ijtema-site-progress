import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

import type { SiteStatus } from "@/types/site";

const VALID_STATUSES: SiteStatus[] = [
  "not_started",
  "laid",
  "preparing",
  "ready_for_inspection",
  "completed",
];

interface RouteContext {
  params: Promise<{
    areaId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
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

  /*
   * 2. READ REQUEST
   */
  const { areaId } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const status =
    typeof body === "object" &&
    body !== null &&
    "status" in body
      ? (body as { status?: unknown }).status
      : undefined;

  /*
   * 3. VALIDATE STATUS
   */
  if (
    typeof status !== "string" ||
    !VALID_STATUSES.includes(status as SiteStatus)
  ) {
    return NextResponse.json(
      { error: "Invalid site status." },
      { status: 400 }
    );
  }

  const newStatus = status as SiteStatus;

  /*
   * 4. MAKE SURE AREA EXISTS
   */
  const { data: existingArea, error: areaError } = await supabaseServer
    .from("site_areas")
    .select("id, name, status, area_type")
    .eq("id", areaId)
    .maybeSingle();

  if (areaError) {
    console.error("Failed to retrieve site area:", areaError);

    return NextResponse.json(
      { error: "The site area could not be checked." },
      { status: 500 }
    );
  }

  if (!existingArea) {
    return NextResponse.json(
      { error: "Site area not found." },
      { status: 404 }
    );
  }

  /*
   * 5. BLOCK READY FOR INSPECTION AND FULL COMPLETION
   *    WHILE URGENT TASKS REMAIN
   *
   * An area with unresolved urgent tasks may remain:
   *
   * Grey  - Not Started
   * Yellow - Laid / Established
   * Amber - Being Prepared
   *
   * But it may NOT become:
   *
   * Blue  - Ready for Inspection
   * Green - Fully Completed
   */
  if (
    newStatus === "ready_for_inspection" ||
    newStatus === "completed"
  ) {
    const { count, error: urgentTaskError } = await supabaseServer
      .from("urgent_tasks")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("area_id", areaId)
      .eq("completed", false);

    if (urgentTaskError) {
      console.error("Failed to check urgent tasks:", urgentTaskError);

      return NextResponse.json(
        { error: "Outstanding urgent tasks could not be checked." },
        { status: 500 }
      );
    }

    if ((count ?? 0) > 0) {
      const blockedStatus =
        newStatus === "completed"
          ? "fully completed"
          : "ready for inspection";

      return NextResponse.json(
        {
          error: `Complete all urgent tasks before marking this area ${blockedStatus}.`,
        },
        { status: 409 }
      );
    }
  }

  /*
   * 6. FULL COMPLETION REQUIRES ALL EQUIPMENT
   *
   * IMPORTANT:
   *
   * Missing equipment does NOT prevent an area from
   * becoming Blue / Ready for Inspection.
   *
   * However, every recorded equipment requirement must
   * be fully on site AND manually confirmed before the
   * area can become Green / Fully Completed.
   */
  if (newStatus === "completed") {
    const {
      data: equipmentRequirements,
      error: equipmentError,
    } = await supabaseServer
      .from("equipment_requirements")
      .select(
        "id, item_name, quantity_required, quantity_received, completed"
      )
      .eq("area_id", areaId);

    if (equipmentError) {
      console.error(
        "Failed to check equipment requirements:",
        equipmentError
      );

      return NextResponse.json(
        { error: "Equipment requirements could not be checked." },
        { status: 500 }
      );
    }

    const incompleteEquipment = (equipmentRequirements ?? []).filter(
      (equipment) =>
        equipment.quantity_received < equipment.quantity_required ||
        !equipment.completed
    );

    if (incompleteEquipment.length > 0) {
      return NextResponse.json(
        {
          error:
            "All required equipment must be on site and confirmed before this area can be marked fully completed.",
          incompleteEquipment: incompleteEquipment.map((equipment) => ({
            id: equipment.id,
            itemName: equipment.item_name,
            quantityRequired: equipment.quantity_required,
            quantityReceived: equipment.quantity_received,
            completed: equipment.completed,
          })),
        },
        { status: 409 }
      );
    }
  }

  /*
   * 7. UPDATE DATABASE
   */
  const { data: updatedArea, error: updateError } = await supabaseServer
    .from("site_areas")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", areaId)
    .select("id, name, status, area_type, updated_at")
    .single();

  if (updateError) {
    console.error("Failed to update site area:", updateError);

    return NextResponse.json(
      { error: "The progress update could not be saved." },
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