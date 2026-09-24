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
  "ijtema_khuddam_task_access";

const SESSION_DURATION_SECONDS =
  60 * 60 * 12;

interface TaskUser {
  username: string;
  password: string;
  phone?: string;
}

export interface KhuddamTaskSession {
  username: string;
  phone: string;
  expiresAt: number;
}

/*
 * These are only phone fallbacks.
 *
 * Passwords remain entirely in KHUDDAM_TASK_USERS_JSON.
 * If you add "phone" to each JSON entry in .env.local,
 * that value takes precedence over this fallback.
 */
const PHONE_BY_USERNAME:
  Record<string, string> = {
    "nea-umair":
      "07453572037",
    "nea-khalif":
      "07403858111",
    "nea-shahzaib":
      "07577822631",
    "nea-akbar":
      "07915175616",
    "nea-sammar":
      "07578830072",
    "nea-attique":
      "07714710835",
  };

function getSecret() {
  const secret =
    process.env
      .KHUDDAM_TASK_SESSION_SECRET ??
    process.env
      .EDITOR_SESSION_SECRET;

  if (
    !secret ||
    secret.length < 24
  ) {
    throw new Error(
      "Khuddam task session secret is missing or too short. Add KHUDDAM_TASK_SESSION_SECRET or configure EDITOR_SESSION_SECRET."
    );
  }

  return secret;
}

function getUsers():
  TaskUser[] {
  const raw =
    process.env
      .KHUDDAM_TASK_USERS_JSON;

  if (!raw) {
    throw new Error(
      "KHUDDAM_TASK_USERS_JSON is not configured."
    );
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(raw);
  } catch {
    throw new Error(
      "KHUDDAM_TASK_USERS_JSON is not valid JSON."
    );
  }

  if (
    !Array.isArray(parsed)
  ) {
    throw new Error(
      "KHUDDAM_TASK_USERS_JSON must be a JSON array."
    );
  }

  const users =
    parsed.filter(
      (
        value
      ): value is TaskUser =>
        Boolean(
          value &&
            typeof value ===
              "object" &&
            typeof (
              value as TaskUser
            ).username ===
              "string" &&
            typeof (
              value as TaskUser
            ).password ===
              "string"
        )
    );

  if (
    users.length === 0
  ) {
    throw new Error(
      "KHUDDAM_TASK_USERS_JSON does not contain any valid users."
    );
  }

  return users;
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

function resolvePhone(
  user: TaskUser
) {
  const fromEnv =
    user.phone?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  return (
    PHONE_BY_USERNAME[
      user.username
        .trim()
        .toLowerCase()
    ] ?? null
  );
}

function createToken(
  user: TaskUser
) {
  const phone =
    resolvePhone(user);

  if (!phone) {
    throw new Error(
      `No phone number is configured for ${user.username}.`
    );
  }

  const payload:
    KhuddamTaskSession =
  {
    username:
      user.username,
    phone,
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
): KhuddamTaskSession | null {
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
        KhuddamTaskSession;

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

export async function getKhuddamTaskSession():
  Promise<
    KhuddamTaskSession | null
  > {
  const cookieStore =
    await cookies();

  return verifyToken(
    cookieStore.get(
      ACCESS_COOKIE
    )?.value
  );
}

export async function GET() {
  const session =
    await getKhuddamTaskSession();

  return NextResponse.json({
    success: true,
    authorised:
      Boolean(session),
    username:
      session?.username ??
      null,
    smsEnabled:
      Boolean(
        session?.phone
      ),
  });
}

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

  let users: TaskUser[];

  try {
    users =
      getUsers();
  } catch (error) {
    console.error(
      "Khuddam task access configuration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Khuddam task access is not configured correctly.",
      },
      {
        status: 500,
      }
    );
  }

  const user =
    users.find(
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
      "Khuddam task access configuration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "This account does not have a completion-SMS phone number configured.",
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
