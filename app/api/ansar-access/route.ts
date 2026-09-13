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

const ACCESS_COOKIE =
  "ijtema_ansar_task_access";

const SESSION_DURATION_SECONDS =
  60 * 60 * 12;

interface TaskUser {
  username: string;
  password: string;
  phone: string;
}

export interface AnsarTaskSession {
  username: string;
  phone: string;
  expiresAt: number;
}

/*
 * Two restricted Ansar task accounts.
 *
 * Each account has its own registered
 * phone number so the correct reporter
 * receives the completion SMS.
 */
const USERS: TaskUser[] = [
  {
    username:
      "AnsarSite1",
    password:
      "AnsarTask2026A!",
    phone:
      "07852776038",
  },
  {
    username:
      "AnsarSite2",
    password:
      "AnsarTask2026B!",
    phone:
      "07802737593",
  },
];

function getSecret() {
  const secret =
    process.env
      .ANSAR_TASK_SESSION_SECRET ??
    process.env
      .EDITOR_SESSION_SECRET;

  if (
    !secret ||
    secret.length < 24
  ) {
    throw new Error(
      "Ansar task session secret is missing or too short. Add ANSAR_TASK_SESSION_SECRET (recommended) or ensure EDITOR_SESSION_SECRET is configured."
    );
  }

  return secret;
}

function safeEqual(
  first: string,
  second: string
) {
  const firstBuffer =
    Buffer.from(
      first,
      "utf8"
    );

  const secondBuffer =
    Buffer.from(
      second,
      "utf8"
    );

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
    .digest(
      "base64url"
    );
}

function createToken(
  user: TaskUser
) {
  const payload:
    AnsarTaskSession =
  {
    username:
      user.username,
    phone:
      user.phone,
    expiresAt:
      Date.now() +
      SESSION_DURATION_SECONDS *
        1000,
  };

  const encoded =
    Buffer.from(
      JSON.stringify(
        payload
      ),
      "utf8"
    ).toString(
      "base64url"
    );

  return `${encoded}.${sign(
    encoded
  )}`;
}

function verifyToken(
  token:
    | string
    | undefined
): AnsarTaskSession | null {
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

  let expectedSignature:
    string;

  try {
    expectedSignature =
      sign(encoded);
  } catch {
    return null;
  }

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
        ).toString(
          "utf8"
        )
      ) as
        AnsarTaskSession;

    if (
      !payload ||
      typeof payload.username !==
        "string" ||
      typeof payload.phone !==
        "string" ||
      typeof payload.expiresAt !==
        "number" ||
      payload.expiresAt <=
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

export async function getAnsarTaskSession():
  Promise<
    AnsarTaskSession | null
  > {
  const cookieStore =
    await cookies();

  return verifyToken(
    cookieStore.get(
      ACCESS_COOKIE
    )?.value
  );
}

/*
 * GET
 * Check the current restricted task session.
 *
 * The phone number deliberately stays server-side.
 */
export async function GET() {
  const session =
    await getAnsarTaskSession();

  return NextResponse.json({
    success: true,
    authorised:
      Boolean(session),
    username:
      session?.username ??
      null,
    smsEnabled:
      Boolean(session),
  });
}

/*
 * POST
 * Restricted urgent-task login.
 */
export async function POST(
  request: NextRequest
) {
  const body =
    (await request
      .json()
      .catch(
        () => null
      )) as
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
          "Enter your username and password.",
      },
      {
        status: 400,
      }
    );
  }

  const username =
    body.username.trim();

  const user =
    USERS.find(
      (candidate) =>
        safeEqual(
          candidate.username,
          username
        )
    );

  if (
    !user ||
    !safeEqual(
      user.password,
      body.password
    )
  ) {
    return NextResponse.json(
      {
        error:
          "The username or password was not accepted.",
      },
      {
        status: 401,
      }
    );
  }

  let token: string;

  try {
    token =
      createToken(user);
  } catch (error) {
    console.error(
      "Ansar task access configuration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Ansar task access is not configured correctly.",
      },
      {
        status: 500,
      }
    );
  }

  const cookieStore =
    await cookies();

  cookieStore.set(
    ACCESS_COOKIE,
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
    smsEnabled: true,
  });
}

/*
 * DELETE
 * Restricted-task logout only.
 */
export async function DELETE(
  request: NextRequest
) {
  const cookieStore =
    await cookies();

  cookieStore.set(
    ACCESS_COOKIE,
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
