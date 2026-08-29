import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

/*
 * COMPLETE / REOPEN URGENT TASK
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

  const { taskId } = await context.params;

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

  const completed =
    typeof body === "object" &&
    body !== null &&
    "completed" in body
      ? (body as { completed?: unknown }).completed
      : undefined;

  if (typeof completed !== "boolean") {
    return NextResponse.json(
      { error: "A valid completed value is required." },
      { status: 400 }
    );
  }

  /*
   * 3. FIND EXISTING TASK
   *
   * Keep the previous state so that if a later
   * operation fails, the task can be restored
   * exactly as it was.
   */
  const {
    data: existingTask,
    error: taskLookupError,
  } = await supabaseServer
    .from("urgent_tasks")
    .select("id, area_id, completed, completed_at")
    .eq("id", taskId)
    .maybeSingle();

  if (taskLookupError) {
    console.error(
      "Failed to retrieve urgent task:",
      taskLookupError
    );

    return NextResponse.json(
      { error: "The urgent task could not be checked." },
      { status: 500 }
    );
  }

  if (!existingTask) {
    return NextResponse.json(
      { error: "Urgent task not found." },
      { status: 404 }
    );
  }

  /*
   * 4. IF REOPENING, CHECK THE FEATURE STATUS
   *
   * Normal areas:
   * Blue / Green → Being Prepared
   *
   * Infrastructure:
   * Blue / Green → Laid / Installed
   */
  let shouldResetAreaStatus = false;

  let rollbackStatus:
    | "laid"
    | "preparing"
    | null = null;

  if (!completed) {
    const {
      data: area,
      error: areaError,
    } = await supabaseServer
      .from("site_areas")
      .select("id, status, area_type")
      .eq("id", existingTask.area_id)
      .maybeSingle();

    if (areaError) {
      console.error(
        "Failed to retrieve site area:",
        areaError
      );

      return NextResponse.json(
        {
          error:
            "The site's progress status could not be checked.",
        },
        { status: 500 }
      );
    }

    if (!area) {
      return NextResponse.json(
        { error: "Site area not found." },
        { status: 404 }
      );
    }

    const isInfrastructure =
      area.area_type === "fence" ||
      area.area_type === "rubber_tracking" ||
      area.area_type === "metal_tracking";

    rollbackStatus = isInfrastructure
      ? "laid"
      : "preparing";

    shouldResetAreaStatus =
      area.status === "ready_for_inspection" ||
      area.status === "completed";
  }

  /*
   * 5. UPDATE TASK
   */
  const newCompletedAt = completed
    ? new Date().toISOString()
    : null;

  const {
    data: updatedTask,
    error: updateError,
  } = await supabaseServer
    .from("urgent_tasks")
    .update({
      completed,
      completed_at: newCompletedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (updateError) {
    console.error(
      "Failed to update urgent task:",
      updateError
    );

    return NextResponse.json(
      { error: "The urgent task could not be updated." },
      { status: 500 }
    );
  }

  /*
   * 6. IF REOPENED WHILE BLUE / GREEN,
   *    ROLLBACK THE FEATURE STATUS
   *
   * Normal area:
   * → preparing
   *
   * Infrastructure:
   * → laid
   */
  if (
    shouldResetAreaStatus &&
    rollbackStatus
  ) {
    const {
      error: statusError,
    } = await supabaseServer
      .from("site_areas")
      .update({
        status: rollbackStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTask.area_id);

    if (statusError) {
      console.error(
        "Failed to reset site area after reopening task:",
        statusError
      );

      /*
       * The urgent task update succeeded but the
       * required site status rollback failed.
       *
       * Restore the task to its exact previous state
       * so the database does not become inconsistent.
       */
      const {
        error: restoreError,
      } = await supabaseServer
        .from("urgent_tasks")
        .update({
          completed: existingTask.completed,
          completed_at: existingTask.completed_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (restoreError) {
        console.error(
          "Failed to restore urgent task after area rollback failure:",
          restoreError
        );
      }

      return NextResponse.json(
        {
          error:
            "The urgent task could not be reopened because the area status could not be reset.",
        },
        { status: 500 }
      );
    }
  }

  /*
   * 7. SUCCESS
   */
  return NextResponse.json({
    success: true,
    task: updatedTask,
    areaStatusChanged: shouldResetAreaStatus,
    areaStatus:
      shouldResetAreaStatus
        ? rollbackStatus
        : null,
  });
}

/*
 * DELETE URGENT TASK
 */
export async function DELETE(
  _request: Request,
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

  const { taskId } = await context.params;

  /*
   * 2. MAKE SURE TASK EXISTS
   */
  const {
    data: existingTask,
    error: lookupError,
  } = await supabaseServer
    .from("urgent_tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();

  if (lookupError) {
    console.error(
      "Failed to retrieve urgent task:",
      lookupError
    );

    return NextResponse.json(
      { error: "The urgent task could not be checked." },
      { status: 500 }
    );
  }

  if (!existingTask) {
    return NextResponse.json(
      { error: "Urgent task not found." },
      { status: 404 }
    );
  }

  /*
   * 3. DELETE TASK
   */
  const {
    error: deleteError,
  } = await supabaseServer
    .from("urgent_tasks")
    .delete()
    .eq("id", taskId);

  if (deleteError) {
    console.error(
      "Failed to delete urgent task:",
      deleteError
    );

    return NextResponse.json(
      { error: "The urgent task could not be removed." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}