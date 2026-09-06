import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { REPORT_SESSION_COOKIE } from "@/lib/auth/reportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(REPORT_SESSION_COOKIE);

  return NextResponse.json({
    success: true,
  });
}
