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

  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

function isHttps(request: NextRequest) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");

  return forwardedProtocol
    ? forwardedProtocol === "https"
    : new URL(request.url).protocol === "https:";
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid login request." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Select an account and enter a password." },
      { status: 400 }
    );
  }

  const accountId = (body as { accountId?: unknown }).accountId;
  const password = (body as { password?: unknown }).password;

  if (typeof accountId !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Select an account and enter a password." },
      { status: 400 }
    );
  }

  const option = getReportLoginOption(accountId);

  if (!option) {
    return NextResponse.json(
      { error: "Invalid reporting credentials." },
      { status: 401 }
    );
  }

  try {
    if (option.role === "admin") {
      const expectedPassword = process.env.REPORT_ADMIN_PASSWORD ?? "Admin";

      if (!safeEqual(password, expectedPassword)) {
        return NextResponse.json(
          { error: "Invalid reporting credentials." },
          { status: 401 }
        );
      }

      const token = createReportSessionToken({ role: "admin" });
      const cookieStore = await cookies();

      cookieStore.set(REPORT_SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: isHttps(request),
        path: "/",
        maxAge: REPORT_SESSION_DURATION_SECONDS,
      });

      return NextResponse.json({
        success: true,
        session: {
          role: "admin",
          label: "Admin",
        },
      });
    }

    const { data: department, error } = await supabaseServer
      .from("report_departments")
      .select("id,name,nazim_name,active")
      .eq("id", option.id)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("Report login department lookup failed:", error);

      return NextResponse.json(
        { error: "Reporting access could not be checked." },
        { status: 500 }
      );
    }

    if (!department) {
      return NextResponse.json(
        { error: "Invalid reporting credentials." },
        { status: 401 }
      );
    }

    // Temporary rule requested for Ijtema testing:
    // each department's password is exactly its department name.
    if (!safeEqual(password, department.name)) {
      return NextResponse.json(
        { error: "Invalid reporting credentials." },
        { status: 401 }
      );
    }

    const token = createReportSessionToken({
      role: "department",
      departmentId: department.id,
    });

    const cookieStore = await cookies();

    cookieStore.set(REPORT_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps(request),
      path: "/",
      maxAge: REPORT_SESSION_DURATION_SECONDS,
    });

    return NextResponse.json({
      success: true,
      session: {
        role: "department",
        departmentId: department.id,
        departmentName: department.name,
        nazimName: department.nazim_name,
      },
    });
  } catch (error) {
    console.error("Report login failed:", error);

    return NextResponse.json(
      {
        error:
          "Reporting authentication is not configured correctly on the server.",
      },
      { status: 500 }
    );
  }
}
