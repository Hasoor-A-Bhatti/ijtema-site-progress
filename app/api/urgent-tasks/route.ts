import { NextResponse } from "next/server";

import { hasAnsarTaskAccess } from "@/app/api/ansar-access/route";
import { getLajnaTaskSession } from "@/app/api/lajna-access/route";
import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * We deliberately check the area on the
 * SERVER.
 *
 * The browser cannot simply pretend an
 * Ansar area is a Lajna area.
 */
async function isLajnaArea(
  areaId: string
) {
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
      "Failed to check Lajna area:",
      error
    );

    return {
      exists: false,
      allowed: false,
      error: true,
    };
  }

  if (!data) {
    return {
      exists: false,
      allowed: false,
      error: false,
    };
  }

  /*
   * This automatically covers:
   *
   * Lajna marquees
   * Lajna metal tracking
   * Lajna rubber tracking
   * Lajna fencing
   * Lajna/Nasirat features
   *
   * provided their database name begins
   * with "Lajna".
   */
  const allowed =
    data.name
      .trim()
      .toLowerCase()
      .startsWith(
        "lajna"
      );

  return {
    exists: true,
    allowed,
    error: false,
  };
}


/*
 * Ansar uses the same restricted urgent-task
 * access model as Lajna.
 *
 * We deliberately check the database area name
 * on the SERVER so a browser cannot pretend a
 * non-Ansar area is an Ansar area.
 */
async function isAnsarArea(
  areaId: string
) {
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
      "Failed to check Ansar area:",
      error
    );

    return {
      exists: false,
      allowed: false,
      error: true,
    };
  }

  if (!data) {
    return {
      exists: false,
      allowed: false,
      error: false,
    };
  }

  /*
   * This automatically covers any Ansar
   * marquee / site area, metal tracking,
   * rubber tracking or fencing whose database
   * name begins with "Ansar".
   */
  const allowed =
    data.name
      .trim()
      .toLowerCase()
      .startsWith(
        "ansar"
      );

  return {
    exists: true,
    allowed,
    error: false,
  };
}

/*
 * GET
 *
 * Remains viewable exactly as before.
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
      .select("*")
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
    tasks: data ?? [],
  });
}

/*
 * POST
 *
 * AUTHORISED WHEN:
 *
 * 1. Existing full editor session
 * OR
 * 2. Lajna task session AND area is Lajna
 * OR
 * 3. Ansar task session AND area is Ansar
 *
 * Full-admin behaviour therefore remains
 * completely unchanged.
 */
export async function POST(
  request: Request
) {
  const body =
    (await request
      .json()
      .catch(() => null)) as
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

  /*
   * Existing full site editor retains
   * permission everywhere.
   */
  const fullEditor =
    await hasValidEditorSession();

  if (!fullEditor) {
    /*
     * No full editor session:
     * check the two narrow task-access sessions.
     *
     * Neither session grants normal editor access.
     */
    const [
      lajnaSession,
      ansarSession,
    ] =
      await Promise.all([
        getLajnaTaskSession(),
        hasAnsarTaskAccess(),
      ]);

    if (
      !lajnaSession &&
      !ansarSession
    ) {
      return NextResponse.json(
        {
          error:
            "Editing access, Lajna task access or Ansar task access is required.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * A Lajna session is valid only for a
     * Lajna area.
     */
    if (lajnaSession) {
      const lajnaAreaCheck =
        await isLajnaArea(
          areaId
        );

      if (
        lajnaAreaCheck.error
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
        !lajnaAreaCheck.exists
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

      if (
        lajnaAreaCheck.allowed
      ) {
        /*
         * Authorised through restricted
         * Lajna task access.
         */
      } else if (
        !ansarSession
      ) {
        return NextResponse.json(
          {
            error:
              "Lajna task access can only raise urgent tasks within Lajna areas.",
          },
          {
            status: 403,
          }
        );
      }
    }

    /*
     * An Ansar session is valid only for an
     * Ansar area.
     *
     * If both narrow sessions happen to exist,
     * either matching area is accepted.
     */
    if (ansarSession) {
      const ansarAreaCheck =
        await isAnsarArea(
          areaId
        );

      if (
        ansarAreaCheck.error
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
        !ansarAreaCheck.exists
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

      if (
        ansarAreaCheck.allowed
      ) {
        /*
         * Authorised through restricted
         * Ansar task access.
         */
      } else if (
        !lajnaSession
      ) {
        return NextResponse.json(
          {
            error:
              "Ansar task access can only raise urgent tasks within Ansar areas.",
          },
          {
            status: 403,
          }
        );
      } else {
        /*
         * Both narrow sessions exist. Make sure
         * the area matched at least one of them.
         */
        const lajnaAreaCheck =
          await isLajnaArea(
            areaId
          );

        if (
          !lajnaAreaCheck.allowed
        ) {
          return NextResponse.json(
            {
              error:
                "Restricted task access can only raise urgent tasks within the matching Lajna or Ansar areas.",
            },
            {
              status: 403,
            }
          );
        }
      }
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
      })
      .select("*")
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

  return NextResponse.json({
    success: true,
    task: data,
  });
}