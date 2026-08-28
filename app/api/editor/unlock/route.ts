import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createEditorSession,
  EDITOR_COOKIE_NAME,
  EDITOR_SESSION_DURATION_SECONDS,
  verifyEditorPassword,
} from "@/lib/auth/editorSession";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body?.password;

    if (typeof password !== "string" || !password.trim()) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    if (!verifyEditorPassword(password)) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );
    }

    const { token, expiresAt } = createEditorSession();

    /*
     * Use a Secure cookie whenever the actual connection is HTTPS.
     *
     * This means:
     * - Local LAN testing over http://192.168... works
     * - Deployed Vercel HTTPS still gets a Secure cookie
     */
    const forwardedProtocol = request.headers.get("x-forwarded-proto");

    const isHttps = forwardedProtocol
      ? forwardedProtocol === "https"
      : new URL(request.url).protocol === "https:";

    const cookieStore = await cookies();

    cookieStore.set(EDITOR_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: EDITOR_SESSION_DURATION_SECONDS,
    });

    return NextResponse.json({
      success: true,
      expiresAt,
    });
  } catch (error) {
    console.error("Editor unlock failed:", error);

    return NextResponse.json(
      { error: "Editing could not be enabled." },
      { status: 500 }
    );
  }
}