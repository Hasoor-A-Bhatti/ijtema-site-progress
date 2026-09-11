import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "ijtema_lajna_task_access";
const SESSION_SECONDS = 12 * 60 * 60;

interface LajnaSession {
  username: string;
  exp: number;
}

function getSecret() {
  const secret =
    process.env.LAJNA_TASK_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "LAJNA_TASK_SESSION_SECRET is not configured."
    );
  }

  return secret;
}

function getUsers(): Record<string, string> {
  const raw =
    process.env.LAJNA_TASK_USERS_JSON;

  if (!raw) {
    throw new Error(
      "LAJNA_TASK_USERS_JSON is not configured."
    );
  }

  try {
    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error();
    }

    return parsed as Record<string, string>;
  } catch {
    throw new Error(
      "LAJNA_TASK_USERS_JSON is invalid."
    );
  }
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function createToken(
  session: LajnaSession
) {
  const encoded = Buffer.from(
    JSON.stringify(session)
  ).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function safeCompare(
  first: string,
  second: string
) {
  const a = Buffer.from(first);
  const b = Buffer.from(second);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function verifyToken(
  token: string
): LajnaSession | null {
  try {
    const [encoded, signature] =
      token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const expected =
      sign(encoded);

    if (
      !safeCompare(
        signature,
        expected
      )
    ) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(
        encoded,
        "base64url"
      ).toString("utf8")
    ) as LajnaSession;

    if (
      !session ||
      typeof session.username !==
        "string" ||
      !Number.isFinite(session.exp)
    ) {
      return null;
    }

    if (
      session.exp <=
      Math.floor(
        Date.now() / 1000
      )
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getLajnaTaskSession() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

/*
 * GET
 * Check whether a Lajna task session exists.
 */
export async function GET() {
  try {
    const session =
      await getLajnaTaskSession();

    return NextResponse.json({
      authorised: Boolean(session),
      username:
        session?.username ??
        null,
    });
  } catch (error) {
    console.error(
      "Lajna access check failed:",
      error
    );

    return NextResponse.json(
      {
        authorised: false,
        username: null,
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * POST
 * Sign into the restricted Lajna
 * urgent-task account.
 */
export async function POST(
  request: Request
) {
  try {
    const body =
      (await request
        .json()
        .catch(() => null)) as
        | {
            username?: unknown;
            password?: unknown;
          }
        | null;

    if (
      !body ||
      typeof body.username !==
        "string" ||
      typeof body.password !==
        "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a username and password.",
        },
        {
          status: 400,
        }
      );
    }

    const username =
      body.username.trim();

    const password =
      body.password;

    const users =
      getUsers();

    const expectedPassword =
      users[username];

    if (
      !expectedPassword ||
      !safeCompare(
        password,
        expectedPassword
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The username or password is incorrect.",
        },
        {
          status: 401,
        }
      );
    }

    const exp =
      Math.floor(
        Date.now() / 1000
      ) + SESSION_SECONDS;

    const token =
      createToken({
        username,
        exp,
      });

    const response =
      NextResponse.json({
        success: true,
        authorised: true,
        username,
      });

    response.cookies.set(
      COOKIE_NAME,
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          SESSION_SECONDS,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Lajna login failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Lajna task access could not be checked.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * DELETE
 * Log out of Lajna task access.
 */
export async function DELETE() {
  const response =
    NextResponse.json({
      success: true,
      authorised: false,
    });

  response.cookies.set(
    COOKIE_NAME,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );

  return response;
}