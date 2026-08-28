import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

/*
 * ADD EQUIPMENT REQUIREMENT
 */
export async function POST(request: Request) {
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
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const {
    areaId,
    itemName,
    quantityRequired,
  } = body as {
    areaId?: unknown;
    itemName?: unknown;
    quantityRequired?: unknown;
  };

  /*
   * 3. VALIDATE
   */
  if (typeof areaId !== "string" || !areaId.trim()) {
    return NextResponse.json(
      { error: "A valid site area is required." },
      { status: 400 }
    );
  }

  if (typeof itemName !== "string" || !itemName.trim()) {
    return NextResponse.json(
      { error: "Equipment name is required." },
      { status: 400 }
    );
  }

  if (
    typeof quantityRequired !== "number" ||
    !Number.isInteger(quantityRequired) ||
    quantityRequired <= 0
  ) {
    return NextResponse.json(
      { error: "Required quantity must be a positive whole number." },
      { status: 400 }
    );
  }

  /*
   * 4. CHECK AREA
   */
  const { data: area, error: areaError } = await supabaseServer
    .from("site_areas")
    .select("id, status")
    .eq("id", areaId)
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

  /*
   * 5. CREATE REQUIREMENT
   *
   * New requirements start with zero received and
   * are therefore not yet complete.
   */
  const { data: equipment, error: insertError } = await supabaseServer
    .from("equipment_requirements")
    .insert({
      area_id: areaId,
      item_name: itemName.trim(),
      quantity_required: quantityRequired,
      quantity_received: 0,
      completed: false,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Failed to add equipment requirement:", insertError);

    return NextResponse.json(
      { error: "The equipment requirement could not be added." },
      { status: 500 }
    );
  }

  /*
   * 6. IF AREA WAS GREEN, A NEW UNFULFILLED REQUIREMENT
   *    MEANS IT IS NO LONGER FULLY COMPLETE.
   *
   * Return it to Amber.
   */
  let areaStatusChanged = false;

  if (area.status === "completed") {
    const { error: statusError } = await supabaseServer
      .from("site_areas")
      .update({
        status: "preparing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", areaId);

    if (statusError) {
      console.error(
        "Equipment was added but area rollback failed:",
        statusError
      );

      /*
       * Undo the equipment creation so Green cannot
       * coexist with an outstanding equipment requirement.
       */
      const { error: rollbackError } = await supabaseServer
        .from("equipment_requirements")
        .delete()
        .eq("id", equipment.id);

      if (rollbackError) {
        console.error(
          "Failed to roll back equipment creation:",
          rollbackError
        );
      }

      return NextResponse.json(
        {
          error:
            "The equipment requirement could not be added because the area status could not be reset.",
        },
        { status: 500 }
      );
    }

    areaStatusChanged = true;
  }

  return NextResponse.json({
    success: true,
    equipment,
    areaStatusChanged,
    areaStatus: areaStatusChanged ? "preparing" : area.status,
  });
}