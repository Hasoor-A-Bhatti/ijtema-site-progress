import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "crypto";

export const EDITOR_COOKIE_NAME = "ijtema_editor_session";

export const EDITOR_SESSION_DURATION_SECONDS = 30 * 60;

function getSessionSecret() {
  const secret = process.env.EDITOR_SESSION_SECRET;

  if (!secret) {
    throw new Error("EDITOR_SESSION_SECRET is not configured.");
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("hex");
}

function hashPassword(password: string) {
  return createHash("sha256")
    .update(password)
    .digest("hex");
}

export function verifyEditorPassword(password: string) {
  const expectedHash = process.env.EDITOR_PASSWORD_HASH;

  if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    throw new Error("EDITOR_PASSWORD_HASH is not configured correctly.");
  }

  const suppliedBuffer = Buffer.from(hashPassword(password), "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export function createEditorSession() {
  const expiresAt =
    Date.now() + EDITOR_SESSION_DURATION_SECONDS * 1000;

  const payload = String(expiresAt);
  const signature = sign(payload);

  return {
    token: `${payload}.${signature}`,
    expiresAt,
  };
}

export function verifyEditorSession(token?: string | null) {
  if (!token) {
    return {
      valid: false,
      expiresAt: null,
    };
  }

  const [payload, suppliedSignature] = token.split(".");

  if (!payload || !suppliedSignature) {
    return {
      valid: false,
      expiresAt: null,
    };
  }

  const expiresAt = Number(payload);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return {
      valid: false,
      expiresAt: null,
    };
  }

  const expectedSignature = sign(payload);

  const suppliedBuffer = Buffer.from(suppliedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return {
      valid: false,
      expiresAt: null,
    };
  }

  return {
    valid: true,
    expiresAt,
  };
}