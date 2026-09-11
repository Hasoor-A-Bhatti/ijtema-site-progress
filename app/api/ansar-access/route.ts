import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANSAR_ACCESS_COOKIE =
  "ijtema_ansar_task_access";

const SESSION_DURATION_SECONDS =
  60 * 60 * 12;

/*
 * These mirror the Lajna login style,
 * just changed to Ansar.
 *
 * You can change the usernames/passwords
 * here if you want.
 */
const ANSAR_USERS = [
  {
    username: "AnsarSite1",
    password: "AnsarTask2026A!",
  },
  {
    username: "AnsarSite2",
    password: "AnsarTask2026B!",
  },
];

interface SessionPayload {
  username: string;
  expiresAt: number;
}

function getSecret() {
  return (
    process.env.ANSAR_ACCESS_SECRET ??
    process.env.EDITOR_SESSION_SECRET ??
    "national-ijtema-2026-ansar-access"
  );
}

function safeEqual(
  first: string,
  second: string
) {
  const firstBuffer =
    Buffer.from(first, "utf8");

  const secondBuffer =
    Buffer.from(second, "utf8");

  if (
    firstBuffer.length !==
    secondBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    firstBuffer,
    secondBuffer
  );
}

function sign(
  value: string
) {
  return createHmac(
    "sha256",
    getSecret()
  )
    .update(value)
    .digest("base64url");
}

function createToken(
  username: string
) {
  const payload: SessionPayload = {
    username,
    expiresAt:
      Date.now() +
      SESSION_DURATION_SECONDS *
        1000,
  };

  const encoded =
    Buffer.from(
      JSON.stringify(payload),
      "utf8"
    ).toString("base64url");

  const signature =
    sign(encoded);

  return `${encoded}.${signature}`;
}

function verifyToken(
  token:
    | string
    | undefined
) {
  if (!token) {
    return null;
  }

  const [
    encoded,
    suppliedSignature,
  ] =
    token.split(".");

  if (
    !encoded ||
    !suppliedSignature
  ) {
    return null;
  }

  const expectedSignature =
    sign(encoded);

  if (
    !safeEqual(
      suppliedSignature,
      expectedSignature
    )
  ) {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      ) as SessionPayload;

    if (
      typeof payload.username !==
        "string" ||
      typeof payload.expiresAt !==
        "number"
    ) {
      return null;
    }

    if (
      payload.expiresAt <
      Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function isHttps(
  request: NextRequest
) {
  const forwardedProtocol =
    request.headers.get(
      "x-forwarded-proto"
    );

  return forwardedProtocol
    ? forwardedProtocol ===
        "https"
    : new URL(
        request.url
      ).protocol ===
        "https:";
}

/*
 * CHECK CURRENT ANSAR SESSION
 */
export async function GET() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      ANSAR_ACCESS_COOKIE
    )?.value;

  const session =
    verifyToken(token);

  return NextResponse.json({
    success: true,
    authorised:
      Boolean(session),
    username:
      session?.username ??
      null,
  });
}

/*
 * ANSAR LOGIN
 */
export async function POST(
  request: NextRequest
) {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Enter your Ansar username and password.",
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
          "Enter your Ansar username and password.",
      },
      {
        status: 400,
      }
    );
  }

  const username =
    (
      body as {
        username?: unknown;
      }
    ).username;

  const password =
    (
      body as {
        password?: unknown;
      }
    ).password;

  if (
    typeof username !==
      "string" ||
    typeof password !==
      "string"
  ) {
    return NextResponse.json(
      {
        error:
          "Enter your Ansar username and password.",
      },
      {
        status: 400,
      }
    );
  }

  const user =
    ANSAR_USERS.find(
      (candidate) =>
        safeEqual(
          candidate.username,
          username.trim()
        )
    );

  if (
    !user ||
    !safeEqual(
      user.password,
      password
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid Ansar credentials.",
      },
      {
        status: 401,
      }
    );
  }

  const token =
    createToken(
      user.username
    );

  const cookieStore =
    await cookies();

  cookieStore.set(
    ANSAR_ACCESS_COOKIE,
    token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        isHttps(request),
      path: "/",
      maxAge:
        SESSION_DURATION_SECONDS,
    }
  );

  return NextResponse.json({
    success: true,
    authorised: true,
    username:
      user.username,
  });
}

/*
 * ANSAR LOGOUT
 */
export async function DELETE(
  request: NextRequest
) {
  const cookieStore =
    await cookies();

  cookieStore.set(
    ANSAR_ACCESS_COOKIE,
    "",
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        isHttps(request),
      path: "/",
      maxAge: 0,
    }
  );

  return NextResponse.json({
    success: true,
    authorised: false,
  });
}

/*
 * This helper is exported so the existing
 * urgent-tasks route can verify Ansar access
 * without creating another file.
 */
export async function hasAnsarTaskAccess() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      ANSAR_ACCESS_COOKIE
    )?.value;

  return Boolean(
    verifyToken(token)
  );
}