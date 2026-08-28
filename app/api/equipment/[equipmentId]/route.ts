import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

interface RouteContext {
  params: Promise<{
    equipmentId: string;
  }>;
}

/*
 * UPDATE EQUIPMENT
 */
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

  const { equipmentId } = await context.params;

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

  /*
   * 3. LOAD EXISTING EQUIPMENT
   */
  const { data: existingEquipment, error: lookupError } =
    await supabaseServer
      .from("equipment_requirements")
      .select("*")
      .eq("id", equipmentId)
      .maybeSingle();

  if (lookupError) {
    console.error(
      "Failed to retrieve equipment requirement:",
      lookupError
    );

    return NextResponse.json(
      { error: "The equipment requirement could not be checked." },
      { status: 500 }
    );
  }

  if (!existingEquipment) {
    return NextResponse.json(
      { error: "Equipment requirement not found." },
      { status: 404 }
    );
  }

  const requestBody = body as {
    quantityRequired?: unknown;
    quantityReceived?: unknown;
    completed?: unknown;
  };

  /*
   * 4. BUILD THE UPDATED VALUES
   */
  let quantityRequired = existingEquipment.quantity_required;
  let quantityReceived = existingEquipment.quantity_received;
  let completed = existingEquipment.completed;

  if (requestBody.quantityRequired !== undefined) {
    if (
      typeof requestBody.quantityRequired !== "number" ||
      !Number.isInteger(requestBody.quantityRequired) ||
      requestBody.quantityRequired <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Required quantity must be a positive whole number.",
        },
        { status: 400 }
      );
    }

    quantityRequired = requestBody.quantityRequired;
  }

  if (requestBody.quantityReceived !== undefined) {
    if (
      typeof requestBody.quantityReceived !== "number" ||
      !Number.isInteger(requestBody.quantityReceived) ||
      requestBody.quantityReceived < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Received quantity must be zero or a positive whole number.",
        },
        { status: 400 }
      );
    }

    quantityReceived = requestBody.quantityReceived;
  }

  if (requestBody.completed !== undefined) {
    if (typeof requestBody.completed !== "boolean") {
      return NextResponse.json(
        {
          error: "A valid completed value is required.",
        },
        { status: 400 }
      );
    }

    completed = requestBody.completed;
  }

  /*
   * If received quantity has dropped below the required
   * amount, completion must automatically be removed.
   */
  if (quantityReceived < quantityRequired) {
    completed = false;
  }

  /*
   * The user may only manually confirm completion once
   * enough equipment is physically on site.
   */
  if (completed && quantityReceived < quantityRequired) {
    return NextResponse.json(
      {
        error:
          "This equipment cannot be marked complete until the full required quantity is on site.",
      },
      { status: 409 }
    );
  }

  /*
   * 5. CHECK CURRENT AREA STATUS
   */
  const { data: area, error: areaError } = await supabaseServer
    .from("site_areas")
    .select("id, status")
    .eq("id", existingEquipment.area_id)
    .maybeSingle();

  if (areaError || !area) {
    console.error(
      "Failed to retrieve equipment site area:",
      areaError
    );

    return NextResponse.json(
      {
        error: "The site's progress status could not be checked.",
      },
      { status: 500 }
    );
  }

  /*
   * The requirement is only fully fulfilled if:
   *
   * 1. enough units are physically on site
   * 2. somebody has manually confirmed completion
   */
  const requirementFulfilled =
    quantityReceived >= quantityRequired &&
    completed;

  /*
   * 6. UPDATE EQUIPMENT
   */
  const { data: updatedEquipment, error: updateError } =
    await supabaseServer
      .from("equipment_requirements")
      .update({
        quantity_required: quantityRequired,
        quantity_received: quantityReceived,
        completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", equipmentId)
      .select("*")
      .single();

  if (updateError) {
    console.error(
      "Failed to update equipment requirement:",
      updateError
    );

    return NextResponse.json(
      {
        error: "The equipment requirement could not be updated.",
      },
      { status: 500 }
    );
  }

  /*
   * 7. GREEN AREA + NOW-INCOMPLETE EQUIPMENT
   *
   * Blue may have missing equipment.
   * Green may not.
   */
  let areaStatusChanged = false;

  if (
    area.status === "completed" &&
    !requirementFulfilled
  ) {
    const { error: statusError } = await supabaseServer
      .from("site_areas")
      .update({
        status: "preparing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingEquipment.area_id);

    if (statusError) {
      console.error(
        "Failed to reset Green area after equipment became incomplete:",
        statusError
      );

      /*
       * Restore equipment exactly as it was.
       */
      const { error: restoreError } = await supabaseServer
        .from("equipment_requirements")
        .update({
          quantity_required:
            existingEquipment.quantity_required,
          quantity_received:
            existingEquipment.quantity_received,
          completed:
            existingEquipment.completed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", equipmentId);

      if (restoreError) {
        console.error(
          "Failed to restore equipment after area rollback failure:",
          restoreError
        );
      }

      return NextResponse.json(
        {
          error:
            "The equipment could not be changed because the area's progress status could not be reset.",
        },
        { status: 500 }
      );
    }

    areaStatusChanged = true;
  }

  return NextResponse.json({
    success: true,
    equipment: updatedEquipment,
    areaStatusChanged,
    areaStatus:
      areaStatusChanged
        ? "preparing"
        : area.status,
  });
}

/*
 * DELETE EQUIPMENT REQUIREMENT
 */
export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  const authorised = await hasValidEditorSession();

  if (!authorised) {
    return NextResponse.json(
      { error: "Editing access is required." },
      { status: 401 }
    );
  }

  const { equipmentId } = await context.params;

  const { data: existingEquipment, error: lookupError } =
    await supabaseServer
      .from("equipment_requirements")
      .select("id")
      .eq("id", equipmentId)
      .maybeSingle();

  if (lookupError) {
    console.error(
      "Failed to retrieve equipment requirement:",
      lookupError
    );

    return NextResponse.json(
      {
        error: "The equipment requirement could not be checked.",
      },
      { status: 500 }
    );
  }

  if (!existingEquipment) {
    return NextResponse.json(
      {
        error: "Equipment requirement not found.",
      },
      { status: 404 }
    );
  }

  const { error: deleteError } = await supabaseServer
    .from("equipment_requirements")
    .delete()
    .eq("id", equipmentId);

  if (deleteError) {
    console.error(
      "Failed to delete equipment requirement:",
      deleteError
    );

    return NextResponse.json(
      {
        error: "The equipment requirement could not be removed.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}