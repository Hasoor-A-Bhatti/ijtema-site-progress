import { NextResponse } from "next/server";

import {
  getReportSession,
  REPORT_SESSION_COOKIE,
} from "@/lib/auth/reportSession";

import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let session;

  try {
    session = await getReportSession();
  } catch (error) {
    console.error("Report session check failed:", error);

    return NextResponse.json(
      {
        authenticated: false,
        error: "Reporting authentication is not configured correctly.",
      },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      session: null,
    });
  }

  if (session.role === "admin") {
    return NextResponse.json({
      authenticated: true,
      session: {
        role: "admin",
        label: "Admin",
      },
    });
  }

  const { data: department, error } = await supabaseServer
    .from("report_departments")
    .select("id,name,nazim_name,active")
    .eq("id", session.departmentId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("Report session department lookup failed:", error);

    return NextResponse.json(
      { authenticated: false, error: "Reporting access could not be checked." },
      { status: 500 }
    );
  }

  if (!department) {
    const cookieStore = await cookies();
    cookieStore.delete(REPORT_SESSION_COOKIE);

    return NextResponse.json({
      authenticated: false,
      session: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      role: "department",
      departmentId: department.id,
      departmentName: department.name,
      nazimName: department.nazim_name,
    },
  });
}
