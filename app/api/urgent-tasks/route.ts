import { NextResponse } from "next/server";

import { getKhuddamTaskSession } from "@/app/api/khuddam-access/route";
import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { infrastructureLines } from "@/data/infrastructureLines";
import { siteAreas } from "@/data/siteAreas";
import {
  sendUrgentTaskCreatedSms,
} from "@/lib/sms/urgentTaskSms";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AreaCheck {
  exists: boolean;
  name: string | null;
  khuddamTaskArea: boolean;
  error: boolean;
}

function getCurrentAreaName(
  areaId: string,
  fallbackName: string | null
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

function isInfrastructureType(
  areaType: string | null
) {
  return (
    areaType === "fence" ||
    areaType ===
      "metal_tracking" ||
    areaType ===
      "rubber_tracking"
  );
}

/*
 * One server-side lookup determines both whether
 * the area exists and which restricted group,
 * if any, is allowed to raise a task there. xyz
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
      khuddamTaskArea: false,
      error: true,
    };
  }

  if (!data) {
    return {
      exists: false,
      name: null,
      khuddamTaskArea: false,
      error: false,
    };
  }

  /*
   * Restricted access is intentionally based on
   * the stable area ID, NOT the display name.
   *
   * This allows map labels to be renamed for the
   * Khuddam / Atfal layout without breaking the
   * existing Lajna / Nasirat / Ansar task-access
   * permissions or historical Supabase records.
   */
  const normalizedAreaId =
    data.id
      .trim()
      .toLowerCase();

  const khuddamTaskArea =
    normalizedAreaId.startsWith(
      "lajna-"
    ) ||
    normalizedAreaId.startsWith(
      "nasirat-"
    ) ||
    normalizedAreaId.startsWith(
      "ansar-"
    ) ||
    isInfrastructureType(
      data.area_type
    );

  return {
    exists: true,
    name:
      getCurrentAreaName(
        data.id,
        data.name
      ),
    khuddamTaskArea,
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
    if (
      !areaCheck
        .khuddamTaskArea
    ) {
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

    const khuddamSession =
      await getKhuddamTaskSession();

    if (!khuddamSession) {
      return NextResponse.json(
        {
          error:
            "Khuddam task access is required to raise urgent tasks for this area.",
        },
        {
          status: 401,
        }
      );
    }

    raisedByUsername =
      khuddamSession.username;

    raisedByPhone =
      khuddamSession.phone;
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
   * task was raised through universal
   * Khuddam task access.
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
    const adminPhones =
      process.env
        .IJTEMA_ADMIN_ALERT_PHONES
        ?.split(",")
        .map(
          (phone) =>
            phone.trim()
        )
        .filter(Boolean) ??
      [];

    if (
      adminPhones.length >
      0
    ) {
      adminSmsAttempted =
        true;

      const smsResults =
        await Promise.all(
          adminPhones.map(
            (phoneNumber) =>
              sendUrgentTaskCreatedSms({
                phoneNumber,
                areaName:
                  areaCheck.name ??
                  "Site area",
                taskText,
                raisedBy:
                  raisedByUsername,
              })
          )
        );

      adminSmsSent =
        smsResults.every(
          (result) =>
            result.success
        );

      const failedMessages =
        smsResults
          .filter(
            (result) =>
              !result.success
          )
          .map(
            (result) =>
              result.error ??
              "SMS could not be sent."
          );

      adminSmsError =
        failedMessages.length >
        0
          ? failedMessages.join(
              " | "
            )
          : null;
    } else {
      console.warn(
        "IJTEMA_ADMIN_ALERT_PHONES is not configured, so new urgent-task SMS alerts are disabled."
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
