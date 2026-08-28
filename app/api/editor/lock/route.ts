import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { EDITOR_COOKIE_NAME } from "@/lib/auth/editorSession";

export async function POST() {
  const cookieStore = await cookies();

  cookieStore.delete(EDITOR_COOKIE_NAME);

  return NextResponse.json({
    success: true,
  });
}