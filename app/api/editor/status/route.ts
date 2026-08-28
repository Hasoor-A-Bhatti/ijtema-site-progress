import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  EDITOR_COOKIE_NAME,
  verifyEditorSession,
} from "@/lib/auth/editorSession";

export async function GET() {
  const cookieStore = await cookies();

  const token = cookieStore.get(EDITOR_COOKIE_NAME)?.value;
  const session = verifyEditorSession(token);

  return NextResponse.json({
    canEdit: session.valid,
    expiresAt: session.expiresAt,
  });
}