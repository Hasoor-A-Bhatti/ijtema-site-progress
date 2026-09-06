import {
  timingSafeEqual,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cookies } from "next/headers";

import {
  createReportSessionToken,
  REPORT_SESSION_COOKIE,
  REPORT_SESSION_DURATION_SECONDS,
} from "@/lib/auth/reportSession";

import { getReportLoginOption } from "@/lib/reports/reportDepartments";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(
    aBuffer,
    bBuffer
  );
}

function isHttps(
  request: NextRequest
) {
  const forwardedProtocol =
    request.headers.get(
      "x-forwarded-proto"
    );

  return forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(
        request.url
      ).protocol === "https:";
}

/*
 * Department passwords are stored
 * server-side in REPORT_DEPARTMENT_PASSWORDS.
 *
 * They are NEVER sent to the browser.
 */
function getDepartmentPasswords(): Record<
  string,
  string
> {
  const raw =
    process.env
      .REPORT_DEPARTMENT_PASSWORDS;

  if (!raw) {
    throw new Error(
      "REPORT_DEPARTMENT_PASSWORDS is not configured."
    );
  }

  const parsed: unknown =
    JSON.parse(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "REPORT_DEPARTMENT_PASSWORDS is invalid."
    );
  }

  const passwords: Record<
    string,
    string
  > = {};

  for (const [key, value] of Object.entries(
    parsed
  )) {
    if (
      typeof value === "string"
    ) {
      passwords[key] = value;
    }
  }

  return passwords;
}

export async function POST(
  request: NextRequest
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid login request.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !== "object" ||
    body === null
  ) {
    return NextResponse.json(
      {
        error:
          "Select an account and enter a password.",
      },
      {
        status: 400,
      }
    );
  }

  const accountId = (
    body as {
      accountId?: unknown;
    }
  ).accountId;

  const password = (
    body as {
      password?: unknown;
    }
  ).password;

  if (
    typeof accountId !==
      "string" ||
    typeof password !==
      "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Select an account and enter a password.",
      },
      {
        status: 400,
      }
    );
  }

  const option =
    getReportLoginOption(
      accountId
    );

  if (!option) {
    return NextResponse.json(
      {
        error:
          "Invalid reporting credentials.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    /*
     * ADMIN LOGIN
     */
    if (
      option.role === "admin"
    ) {
      const expectedPassword =
        process.env
          .REPORT_ADMIN_PASSWORD ??
        "Admin";

      if (
        !safeEqual(
          password,
          expectedPassword
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid reporting credentials.",
          },
          {
            status: 401,
          }
        );
      }

      const token =
        createReportSessionToken({
          role: "admin",
        });

      const cookieStore =
        await cookies();

      cookieStore.set(
        REPORT_SESSION_COOKIE,
        token,
        {
          httpOnly: true,
          sameSite: "lax",
          secure:
            isHttps(request),
          path: "/",
          maxAge:
            REPORT_SESSION_DURATION_SECONDS,
        }
      );

      return NextResponse.json({
        success: true,
        session: {
          role: "admin",
          label: "Admin",
        },
      });
    }

    /*
     * DEPARTMENT LOGIN
     */
    const {
      data: department,
      error,
    } = await supabaseServer
      .from(
        "report_departments"
      )
      .select(
        "id,name,nazim_name,active"
      )
      .eq(
        "id",
        option.id
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Report login department lookup failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Reporting access could not be checked.",
        },
        {
          status: 500,
        }
      );
    }

    if (!department) {
      return NextResponse.json(
        {
          error:
            "Invalid reporting credentials.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * Get this department's password
     * from the server environment.
     */
    const departmentPasswords =
      getDepartmentPasswords();

    const expectedPassword =
      departmentPasswords[
        department.id
      ];

    if (
      !expectedPassword ||
      !safeEqual(
        password,
        expectedPassword
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid reporting credentials.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * LOGIN SUCCESSFUL
     */
    const token =
      createReportSessionToken({
        role: "department",
        departmentId:
          department.id,
      });

    const cookieStore =
      await cookies();

    cookieStore.set(
      REPORT_SESSION_COOKIE,
      token,
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          isHttps(request),
        path: "/",
        maxAge:
          REPORT_SESSION_DURATION_SECONDS,
      }
    );

    return NextResponse.json({
      success: true,
      session: {
        role: "department",
        departmentId:
          department.id,
        departmentName:
          department.name,
        nazimName:
          department.nazim_name,
      },
    });
  } catch (error) {
    console.error(
      "Report login failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Reporting authentication is not configured correctly on the server.",
      },
      {
        status: 500,
      }
    );
  }
}