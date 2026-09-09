import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  cookies,
} from "next/headers";

import {
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME =
  "ijtema_site_access_v2";

const SESSION_DURATION_SECONDS =
  12 * 60 * 60;

interface SessionPayload {
  expiresAt: number;
}

function getPasswordHash() {
  const value =
    process.env
      .SITE_ACCESS_PASSWORD_HASH
      ?.trim();

  if (!value) {
    throw new Error(
      "SITE_ACCESS_PASSWORD_HASH is not configured."
    );
  }

  return value.toLowerCase();
}

function getSessionSecret() {
  const value =
    process.env
      .SITE_ACCESS_SESSION_SECRET
      ?.trim();

  if (!value) {
    throw new Error(
      "SITE_ACCESS_SESSION_SECRET is not configured."
    );
  }

  return value;
}

function hashPassword(
  password: string
) {
  return createHash(
    "sha256"
  )
    .update(
      password,
      "utf8"
    )
    .digest(
      "hex"
    );
}

function safeEqualHex(
  left: string,
  right: string
) {
  if (
    !/^[0-9a-f]{64}$/i.test(
      left
    ) ||
    !/^[0-9a-f]{64}$/i.test(
      right
    )
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(
      left,
      "hex"
    );

  const rightBuffer =
    Buffer.from(
      right,
      "hex"
    );

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

function encodePayload(
  payload: SessionPayload
) {
  return Buffer.from(
    JSON.stringify(
      payload
    ),
    "utf8"
  ).toString(
    "base64url"
  );
}

function signPayload(
  encodedPayload: string
) {
  return createHmac(
    "sha256",
    getSessionSecret()
  )
    .update(
      encodedPayload,
      "utf8"
    )
    .digest(
      "base64url"
    );
}

function createSessionToken() {
  const payload: SessionPayload = {
    expiresAt:
      Date.now() +
      SESSION_DURATION_SECONDS *
        1000,
  };

  const encodedPayload =
    encodePayload(
      payload
    );

  const signature =
    signPayload(
      encodedPayload
    );

  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(
  token: string
) {
  const [
    encodedPayload,
    providedSignature,
  ] =
    token.split(
      "."
    );

  if (
    !encodedPayload ||
    !providedSignature
  ) {
    return false;
  }

  const expectedSignature =
    signPayload(
      encodedPayload
    );

  const providedBuffer =
    Buffer.from(
      providedSignature,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  if (
    !timingSafeEqual(
      providedBuffer,
      expectedBuffer
    )
  ) {
    return false;
  }

  try {
    const payload =
      JSON.parse(
        Buffer.from(
          encodedPayload,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as Partial<SessionPayload>;

    return (
      typeof payload.expiresAt ===
        "number" &&
      Number.isFinite(
        payload.expiresAt
      ) &&
      payload.expiresAt >
        Date.now()
    );
  } catch {
    return false;
  }
}

async function hasValidSiteSession() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore
      .get(
        COOKIE_NAME
      )
      ?.value;

  if (!token) {
    return false;
  }

  try {
    return verifySessionToken(
      token
    );
  } catch {
    return false;
  }
}

/*
 * GET /api/site-access
 *
 * Used by SiteAccessGate to check whether the browser
 * already has a valid website-access session.
 *
 * IMPORTANT:
 * This does NOT check or create an editor session.
 */
export async function GET() {
  try {
    const authorised =
      await hasValidSiteSession();

    return NextResponse.json({
      success: true,
      authorised,
    });
  } catch (
    error
  ) {
    console.error(
      "Site access status failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        authorised: false,
        error:
          "Site access is not configured correctly.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * POST /api/site-access
 *
 * Verifies the website-entry password and creates a
 * completely separate HttpOnly site-access cookie.
 *
 * It NEVER calls /api/editor/unlock and therefore
 * entering the website does NOT enable editing.
 */
export async function POST(
  request: Request
) {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid request.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !==
      "object" ||
    body === null ||
    !(
      "password" in
      body
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Enter the site password.",
      },
      {
        status: 400,
      }
    );
  }

  const password =
    (
      body as {
        password?: unknown;
      }
    ).password;

  if (
    typeof password !==
      "string"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Enter the site password.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const submittedHash =
      hashPassword(
        password
      );

    const configuredHash =
      getPasswordHash();

    if (
      !safeEqualHex(
        submittedHash,
        configuredHash
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Incorrect password.",
        },
        {
          status: 401,
        }
      );
    }

    const token =
      createSessionToken();

    const response =
      NextResponse.json({
        success: true,
        authorised: true,
      });

    response.cookies.set(
      COOKIE_NAME,
      token,
      {
        httpOnly: true,
        secure:
          process.env
            .NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          SESSION_DURATION_SECONDS,
      }
    );

    return response;
  } catch (
    error
  ) {
    console.error(
      "Site access login failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Site access is not configured correctly.",
      },
      {
        status: 500,
      }
    );
  }
}
