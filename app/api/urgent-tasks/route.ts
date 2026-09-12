import { NextResponse } from "next/server";

import { getAnsarTaskSession } from "@/app/api/ansar-access/route";
import { getLajnaTaskSession } from "@/app/api/lajna-access/route";
import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import {
  sendUrgentTaskCreatedSms,
} from "@/lib/sms/urgentTaskSms";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RestrictedGroup =
  | "lajna"
  | "ansar";

interface AreaCheck {
  exists: boolean;
  name: string | null;
  group: RestrictedGroup | null;
  error: boolean;
}

/*
 * One server-side lookup determines both whether
 * the area exists and which restricted group,
 * if any, is allowed to raise a task there.
 */
async function getAreaCheck(
  areaId: string
): Promise<AreaCheck> {
  const {
    data,
    error,
  } =
    await supabaseServer
      .from("site_areas")
      .select(
        "id, name, area_type"
      )
      .eq(
        "id",
        areaId
      )
      .maybeSingle();

  if (error) {
    console.error(
      "Failed to check urgent-task area:",
      error
    );

    return {
      exists: false,
      name: null,
      group: null,
      error: true,
    };
  }

  if (!data) {
    return {
      exists: false,
      name: null,
      group: null,
      error: false,
    };
  }

  const normalizedName =
    data.name
      .trim()
      .toLowerCase();

  const group:
    RestrictedGroup | null =
    normalizedName.startsWith(
      "lajna"
    )
      ? "lajna"
      : normalizedName.startsWith(
            "ansar"
          )
        ? "ansar"
        : null;

  return {
    exists: true,
    name:
      data.name,
    group,
    error: false,
  };
}

/*
 * GET
 *
 * Public/view-only loading remains available.
 *
 * IMPORTANT:
 * Phone numbers and reporter identity are not
 * selected here, so they never leak to browsers.
 */
export async function GET(
  request: Request
) {
  const url =
    new URL(
      request.url
    );

  const areaId =
    url.searchParams
      .get("areaId")
      ?.trim();

  if (!areaId) {
    return NextResponse.json(
      {
        error:
          "A valid site area is required.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    data,
    error,
  } =
    await supabaseServer
      .from("urgent_tasks")
      .select(
        "id, area_id, task_text, completed, created_at, updated_at"
      )
      .eq(
        "area_id",
        areaId
      )
      .order(
        "completed",
        {
          ascending: true,
        }
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    console.error(
      "Failed to load urgent tasks:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Urgent tasks could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    tasks:
      data ?? [],
  });
}

/*
 * POST
 *
 * AUTHORISED WHEN:
 *
 * 1. Full editor session
 * OR
 * 2. Lajna task session on a Lajna area
 * OR
 * 3. Ansar task session on an Ansar area
 *
 * Restricted sessions also attach the registered
 * account phone to the task, entirely server-side.
 */
export async function POST(
  request: Request
) {
  const body =
    (await request
      .json()
      .catch(
        () => null
      )) as
      | {
          areaId?: unknown;
          taskText?: unknown;
        }
      | null;

  if (
    !body ||
    typeof body.areaId !==
      "string" ||
    typeof body.taskText !==
      "string"
  ) {
    return NextResponse.json(
      {
        error:
          "A valid area and urgent task are required.",
      },
      {
        status: 400,
      }
    );
  }

  const areaId =
    body.areaId.trim();

  const taskText =
    body.taskText.trim();

  if (!areaId) {
    return NextResponse.json(
      {
        error:
          "A valid site area is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !taskText ||
    taskText.length > 500
  ) {
    return NextResponse.json(
      {
        error:
          "Enter an urgent task between 1 and 500 characters.",
      },
      {
        status: 400,
      }
    );
  }

  const areaCheck =
    await getAreaCheck(
      areaId
    );

  if (
    areaCheck.error
  ) {
    return NextResponse.json(
      {
        error:
          "The selected site area could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    !areaCheck.exists
  ) {
    return NextResponse.json(
      {
        error:
          "Site area not found.",
      },
      {
        status: 404,
      }
    );
  }

  const fullEditor =
    await hasValidEditorSession();

  let raisedByUsername:
    string | null = null;

  let raisedByPhone:
    string | null = null;

  if (!fullEditor) {
    const [
      lajnaSession,
      ansarSession,
    ] =
      await Promise.all([
        getLajnaTaskSession(),
        getAnsarTaskSession(),
      ]);

    if (
      areaCheck.group ===
        "lajna"
    ) {
      if (!lajnaSession) {
        return NextResponse.json(
          {
            error:
              "Lajna task access is required to raise urgent tasks within Lajna areas.",
          },
          {
            status: 401,
          }
        );
      }

      raisedByUsername =
        lajnaSession.username;

      raisedByPhone =
        lajnaSession.phone;
    } else if (
      areaCheck.group ===
        "ansar"
    ) {
      if (!ansarSession) {
        return NextResponse.json(
          {
            error:
              "Ansar task access is required to raise urgent tasks within Ansar areas.",
          },
          {
            status: 401,
          }
        );
      }

      raisedByUsername =
        ansarSession.username;

      raisedByPhone =
        ansarSession.phone;
    } else {
      /*
       * Narrow sessions do not grant access
       * outside their own areas.
       */
      return NextResponse.json(
        {
          error:
            "Editing access is required for this site area.",
        },
        {
          status: 403,
        }
      );
    }
  }

  const {
    data,
    error,
  } =
    await supabaseServer
      .from("urgent_tasks")
      .insert({
        area_id:
          areaId,
        task_text:
          taskText,
        completed:
          false,
        raised_by_username:
          raisedByUsername,
        raised_by_phone:
          raisedByPhone,
        completion_sms_sent_at:
          null,
      })
      .select(
        "id, area_id, task_text, completed, created_at, updated_at"
      )
      .single();

  if (error) {
    console.error(
      "Failed to add urgent task:",
      error
    );

    return NextResponse.json(
      {
        error:
          "The urgent task could not be added.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * Notify the site/admin phone only when the
   * task was raised through restricted Lajna /
   * Ansar access.
   *
   * Full editor-created tasks deliberately do
   * not trigger this alert.
   */
  let adminSmsAttempted =
    false;

  let adminSmsSent =
    false;

  let adminSmsError:
    string | null =
    null;

  if (
    raisedByUsername &&
    raisedByPhone
  ) {
    const adminPhone =
      process.env
        .IJTEMA_ADMIN_ALERT_PHONE;

    if (
      adminPhone
    ) {
      adminSmsAttempted =
        true;

      const smsResult =
        await sendUrgentTaskCreatedSms({
          phoneNumber:
            adminPhone,
          areaName:
            areaCheck.name ??
            "Site area",
          taskText,
          raisedBy:
            raisedByUsername,
        });

      adminSmsSent =
        smsResult.success;

      adminSmsError =
        smsResult.success
          ? null
          : smsResult.error ??
            "The site alert SMS could not be sent.";
    } else {
      console.warn(
        "IJTEMA_ADMIN_ALERT_PHONE is not configured, so new urgent-task SMS alerts are disabled."
      );
    }
  }

  return NextResponse.json({
    success: true,
    task: data,
    completionSmsEnabled:
      Boolean(
        raisedByPhone
      ),
    adminSms: {
      attempted:
        adminSmsAttempted,
      sent:
        adminSmsSent,
      error:
        adminSmsError,
    },
  });
}
