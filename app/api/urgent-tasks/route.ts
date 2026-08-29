import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const {
    areaId,
    taskText,
  } = body as {
    areaId?: unknown;
    taskText?: unknown;
  };

  if (
    typeof areaId !== "string" ||
    !areaId.trim()
  ) {
    return NextResponse.json(
      { error: "A valid site area is required." },
      { status: 400 }
    );
  }

  if (
    typeof taskText !== "string" ||
    !taskText.trim()
  ) {
    return NextResponse.json(
      { error: "Urgent task text is required." },
      { status: 400 }
    );
  }

  const cleanAreaId = areaId.trim();
  const cleanTaskText = taskText.trim();

  /*
   * 3. MAKE SURE AREA / FEATURE EXISTS
   *
   * area_type is also loaded so infrastructure
   * can use a different rollback status.
   */
  const {
    data: area,
    error: areaError,
  } = await supabaseServer
    .from("site_areas")
    .select("id, status, area_type")
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
   * Infrastructure has no "Being Prepared" stage.
   *
   * If an urgent issue is added while Blue or Green:
   *
   * Infrastructure → Laid / Installed
   * Normal area    → Being Prepared
   */
  const isInfrastructure =
    area.area_type === "fence" ||
    area.area_type === "rubber_tracking" ||
    area.area_type === "metal_tracking";

  const rollbackStatus =
    isInfrastructure
      ? "laid"
      : "preparing";

  /*
   * 4. CREATE URGENT TASK
   */
  const {
    data: task,
    error: taskError,
  } = await supabaseServer
    .from("urgent_tasks")
    .insert({
      area_id: cleanAreaId,
      task_text: cleanTaskText,
      completed: false,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (taskError) {
    console.error(
      "Failed to create urgent task:",
      taskError
    );

    return NextResponse.json(
      { error: "The urgent task could not be added." },
      { status: 500 }
    );
  }

  /*
   * 5. BLUE / GREEN FEATURES WITH A NEW ISSUE
   *    AUTOMATICALLY ROLLBACK.
   *
   * Normal areas:
   * Blue / Green → Amber
   *
   * Infrastructure:
   * Blue / Green → Yellow
   */
  let areaStatusChanged = false;

  if (
    area.status === "ready_for_inspection" ||
    area.status === "completed"
  ) {
    const { error: statusError } =
      await supabaseServer
        .from("site_areas")
        .update({
          status: rollbackStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cleanAreaId);

    if (statusError) {
      console.error(
        "Urgent task was created but area rollback failed:",
        statusError
      );

      /*
       * Remove the newly-created task so the system
       * cannot remain Blue/Green with an unresolved
       * urgent issue.
       */
      const { error: rollbackTaskError } =
        await supabaseServer
          .from("urgent_tasks")
          .delete()
          .eq("id", task.id);

      if (rollbackTaskError) {
        console.error(
          "Failed to roll back urgent task:",
          rollbackTaskError
        );
      }

      return NextResponse.json(
        {
          error:
            "The urgent task could not be added because the area status could not be reset.",
        },
        { status: 500 }
      );
    }

    areaStatusChanged = true;
  }

  /*
   * 6. SUCCESS
   */
  return NextResponse.json({
    success: true,
    task,
    areaStatusChanged,
    areaStatus:
      areaStatusChanged
        ? rollbackStatus
        : area.status,
  });
}