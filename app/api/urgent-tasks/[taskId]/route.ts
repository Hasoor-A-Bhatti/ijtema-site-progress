import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { infrastructureLines } from "@/data/infrastructureLines";
import { siteAreas } from "@/data/siteAreas";
import { sendUrgentTaskResolvedSms } from "@/lib/sms/urgentTaskSms";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCurrentAreaName(
  areaId: string,
  fallbackName: string
) {
  return (
    siteAreas.find(
      (area) =>
        area.id === areaId
    )?.name ??
    infrastructureLines.find(
      (area) =>
        area.id === areaId
    )?.name ??
    fallbackName
  );
}

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

interface ExistingTask {
  id: string;
  area_id: string;
  task_text: string;
  completed: boolean;
  raised_by_username: string | null;
  raised_by_phone: string | null;
  completion_sms_sent_at: string | null;
  resolved_at: string | null;
}

/*
 * PATCH
 *
 * Still ADMIN / FULL EDITOR only.
 *
 * When a restricted-account task genuinely changes
 * from unresolved -> resolved, send one SMS to the
 * registered account phone.
 */
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
    taskId,
  } =
    await context.params;

  const cleanTaskId =
    taskId?.trim();

  if (!cleanTaskId) {
    return NextResponse.json(
      {
        error:
          "A valid urgent task is required.",
      },
      {
        status: 400,
      }
    );
  }

  const body =
    (await request
      .json()
      .catch(
        () => null
      )) as
      | {
          completed?: unknown;
        }
      | null;

  if (
    !body ||
    typeof body.completed !==
      "boolean"
  ) {
    return NextResponse.json(
      {
        error:
          "A valid completion status is required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data:
      existingTaskData,
    error:
      existingTaskError,
  } =
    await supabaseServer
      .from("urgent_tasks")
      .select(
        "id, area_id, task_text, completed, raised_by_username, raised_by_phone, completion_sms_sent_at, resolved_at"
      )
      .eq(
        "id",
        cleanTaskId
      )
      .maybeSingle();

  if (
    existingTaskError
  ) {
    console.error(
      "Failed to load urgent task before update:",
      existingTaskError
    );

    return NextResponse.json(
      {
        error:
          "The urgent task could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    !existingTaskData
  ) {
    return NextResponse.json(
      {
        error:
          "Urgent task not found.",
      },
      {
        status: 404,
      }
    );
  }

  const existingTask =
    existingTaskData as ExistingTask;

  const isNewCompletion =
    !existingTask.completed &&
    body.completed;

  const isReopened =
    existingTask.completed &&
    !body.completed;

  const now =
    new Date().toISOString();

  /*
   * First save the operational task state.
   * SMS failure must never prevent the site team
   * from completing an urgent task.
   */
  const {
    data:
      updatedTask,
    error:
      updateError,
  } =
    await supabaseServer
      .from("urgent_tasks")
      .update({
        completed:
          body.completed,
        updated_at:
          now,

        /*
         * Store the actual resolution timestamp independently
         * of SMS delivery. This applies equally to tasks raised
         * by an admin/editor and tasks raised through a portal.
         *
         * If a task is reopened, clear resolved_at so the next
         * genuine resolution receives a fresh timestamp.
         */
        resolved_at:
          isNewCompletion
            ? now
            : isReopened
              ? null
              : existingTask.resolved_at,
      })
      .eq(
        "id",
        cleanTaskId
      )
      .select(
        "id, area_id, task_text, completed, created_at, updated_at, resolved_at"
      )
      .single();

  if (updateError) {
    console.error(
      "Failed to update urgent task:",
      updateError
    );

    return NextResponse.json(
      {
        error:
          "The urgent task could not be updated.",
      },
      {
        status: 500,
      }
    );
  }

  let smsAttempted =
    false;

  let smsSent =
    false;

  let smsError:
    string | null =
    null;

  if (
    isNewCompletion &&
    existingTask
      .raised_by_phone &&
    !existingTask
      .completion_sms_sent_at
  ) {
    smsAttempted =
      true;

    const {
      data:
        area,
      error:
        areaError,
    } =
      await supabaseServer
        .from("site_areas")
        .select(
          "id, name"
        )
        .eq(
          "id",
          existingTask.area_id
        )
        .maybeSingle();

    if (
      areaError ||
      !area
    ) {
      console.error(
        "Urgent task completed but its area could not be loaded for SMS:",
        areaError
      );

      smsError =
        "The issue was resolved, but the SMS could not be prepared because the site area could not be loaded.";
    } else {
      const smsResult =
        await sendUrgentTaskResolvedSms({
          phoneNumber:
            existingTask
              .raised_by_phone,
          areaName:
            getCurrentAreaName(
              existingTask.area_id,
              area.name
            ),
          taskText:
            existingTask
              .task_text,
        });

      smsSent =
        smsResult.success;

      smsError =
        smsResult.success
          ? null
          : smsResult.error ??
            "The completion SMS could not be sent.";

      if (
        smsResult.success
      ) {
        const {
          error:
            smsStampError,
        } =
          await supabaseServer
            .from(
              "urgent_tasks"
            )
            .update({
              completion_sms_sent_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              cleanTaskId
            )
            .is(
              "completion_sms_sent_at",
              null
            );

        if (
          smsStampError
        ) {
          /*
           * The SMS itself has already gone out.
           * Log this loudly because failure to stamp
           * may permit a later duplicate if the task
           * is reopened and completed again.
           */
          console.error(
            "SMS sent but completion_sms_sent_at could not be recorded:",
            smsStampError
          );
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    task:
      updatedTask,
    sms: {
      attempted:
        smsAttempted,
      sent:
        smsSent,
      error:
        smsError,
    },
  });
}

/*
 * DELETE
 *
 * Existing full-editor-only behaviour.
 */
export async function DELETE(
  _request: Request,
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
    taskId,
  } =
    await context.params;

  const cleanTaskId =
    taskId?.trim();

  if (!cleanTaskId) {
    return NextResponse.json(
      {
        error:
          "A valid urgent task is required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    error,
  } =
    await supabaseServer
      .from("urgent_tasks")
      .delete()
      .eq(
        "id",
        cleanTaskId
      );

  if (error) {
    console.error(
      "Failed to remove urgent task:",
      error
    );

    return NextResponse.json(
      {
        error:
          "The urgent task could not be removed.",
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
