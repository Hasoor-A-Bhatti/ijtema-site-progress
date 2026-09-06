import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import { cookies } from "next/headers";

export const REPORT_SESSION_COOKIE = "ijtema_report_session";
export const REPORT_SESSION_DURATION_SECONDS = 60 * 60 * 12;

type AdminReportSession = {
  role: "admin";
  exp: number;
};

type DepartmentReportSession = {
  role: "department";
  departmentId: string;
  exp: number;
};

export type ReportSession =
  | AdminReportSession
  | DepartmentReportSession;

function getSecret() {
  const secret = process.env.REPORT_SESSION_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error(
      "REPORT_SESSION_SECRET is missing or too short. Add a long random value to .env.local and Vercel."
    );
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

export function createReportSessionToken(
  session:
    | { role: "admin" }
    | { role: "department"; departmentId: string }
) {
  const payload: ReportSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + REPORT_SESSION_DURATION_SECONDS,
  } as ReportSession;

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encoded);

  return `${encoded}.${signature}`;
}

export function verifyReportSessionToken(token: string): ReportSession | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) return null;

    const expectedSignature = signPayload(encoded);

    if (!signaturesMatch(signature, expectedSignature)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as ReportSession;

    if (!payload || typeof payload !== "object") return null;
    if (payload.role !== "admin" && payload.role !== "department") return null;
    if (!Number.isFinite(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    if (
      payload.role === "department" &&
      (!payload.departmentId || typeof payload.departmentId !== "string")
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getReportSession(): Promise<ReportSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REPORT_SESSION_COOKIE)?.value;

  if (!token) return null;

  return verifyReportSessionToken(token);
}

export async function canAccessDepartmentReport(departmentId: string) {
  const session = await getReportSession();

  if (!session) {
    return {
      allowed: false as const,
      status: 401,
      session: null,
    };
  }

  if (session.role === "admin") {
    return {
      allowed: true as const,
      status: 200,
      session,
    };
  }

  if (session.departmentId !== departmentId) {
    return {
      allowed: false as const,
      status: 403,
      session,
    };
  }

  return {
    allowed: true as const,
    status: 200,
    session,
  };
}
