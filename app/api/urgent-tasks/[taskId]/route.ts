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
      {
        error: "Editing access is required.",
      },
      {
        status: 401,
      }
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
      {
        error: "Invalid request body.",
      },
      {
        status: 400,
      }
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
      {
        error: "A valid completed value is required.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 3. FIND EXISTING TASK
   *
   * We keep the original completed_at value so that,
   * if anything later fails, we can restore the task
   * exactly as it was before the request.
   */
  const {
    data: existingTask,
    error: taskLookupError,
  } = await supabaseServer
    .from("urgent_tasks")
    .select(
      "id, area_id, completed, completed_at"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (taskLookupError) {
    console.error(
      "Failed to retrieve urgent task:",
      taskLookupError
    );

    return NextResponse.json(
      {
        error: "The urgent task could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  if (!existingTask) {
    return NextResponse.json(
      {
        error: "Urgent task not found.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * 4. IF REOPENING THE TASK, CHECK THE AREA STATUS
   *
   * Reopening a task means the area once again has
   * an unresolved issue.
   *
   * If the area is Blue or Green, it must return
   * to Amber.
   */
  let shouldResetAreaToPreparing = false;

  if (!completed) {
    const {
      data: area,
      error: areaError,
    } = await supabaseServer
      .from("site_areas")
      .select("id, status")
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
        {
          status: 500,
        }
      );
    }

    if (!area) {
      return NextResponse.json(
        {
          error: "Site area not found.",
        },
        {
          status: 404,
        }
      );
    }

    shouldResetAreaToPreparing =
      area.status === "ready_for_inspection" ||
      area.status === "completed";
  }

  /*
   * 5. UPDATE TASK
   */
  const newCompletedAt =
    completed
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
      {
        error: "The urgent task could not be updated.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * 6. IF THE TASK WAS REOPENED WHILE THE AREA
   *    WAS BLUE OR GREEN, RESET THE AREA TO AMBER.
   */
  if (shouldResetAreaToPreparing) {
    const {
      error: statusError,
    } = await supabaseServer
      .from("site_areas")
      .update({
        status: "preparing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTask.area_id);

    if (statusError) {
      console.error(
        "Failed to reset site area after reopening task:",
        statusError
      );

      /*
       * The task update succeeded but the required
       * status rollback failed.
       *
       * Restore the task exactly to its previous state
       * so we do not leave the system inconsistent.
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
        {
          status: 500,
        }
      );
    }
  }

  return NextResponse.json({
    success: true,
    task: updatedTask,
    areaStatusChanged:
      shouldResetAreaToPreparing,
    areaStatus:
      shouldResetAreaToPreparing
        ? "preparing"
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
      {
        error: "Editing access is required.",
      },
      {
        status: 401,
      }
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
      {
        error: "The urgent task could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  if (!existingTask) {
    return NextResponse.json(
      {
        error: "Urgent task not found.",
      },
      {
        status: 404,
      }
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
      {
        error: "The urgent task could not be removed.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
  });
}