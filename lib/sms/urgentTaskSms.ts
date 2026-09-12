import "server-only";

const TWILIO_API_BASE =
  "https://api.twilio.com/2010-04-01";

/*
 * Convert a UK mobile such as:
 *
 * 07480852059
 *
 * into Twilio / E.164 format:
 *
 * +447480852059
 */
export function toE164UkMobile(
  phoneNumber: string
) {
  const clean =
    phoneNumber.replace(
      /[\s()-]/g,
      ""
    );

  if (
    /^\+44\d{10}$/.test(
      clean
    )
  ) {
    return clean;
  }

  if (
    /^44\d{10}$/.test(
      clean
    )
  ) {
    return `+${clean}`;
  }

  if (
    /^0\d{10}$/.test(
      clean
    )
  ) {
    return `+44${clean.slice(
      1
    )}`;
  }

  throw new Error(
    `Invalid UK phone number: ${phoneNumber}`
  );
}

function getTwilioConfig() {
  const accountSid =
    process.env
      .TWILIO_ACCOUNT_SID;

  const authToken =
    process.env
      .TWILIO_AUTH_TOKEN;

  const messagingServiceSid =
    process.env
      .TWILIO_MESSAGING_SERVICE_SID;

  if (
    !accountSid ||
    !authToken ||
    !messagingServiceSid
  ) {
    throw new Error(
      "Twilio SMS is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID."
    );
  }

  return {
    accountSid,
    authToken,
    messagingServiceSid,
  };
}

function compactTaskText(
  taskText: string,
  maxLength = 85
) {
  const clean =
    taskText
      .replace(/\s+/g, " ")
      .trim();

  if (
    clean.length <=
    maxLength
  ) {
    return clean;
  }

  return `${clean.slice(
    0,
    maxLength - 1
  )}…`;
}

async function sendSms(
  phoneNumber: string,
  body: string
) {
  try {
    const {
      accountSid,
      authToken,
      messagingServiceSid,
    } =
      getTwilioConfig();

    const to =
      toE164UkMobile(
        phoneNumber
      );

    const form =
      new URLSearchParams();

    form.set(
      "To",
      to
    );

    form.set(
      "MessagingServiceSid",
      messagingServiceSid
    );

    form.set(
      "Body",
      body
    );

    const basicAuth =
      Buffer.from(
        `${accountSid}:${authToken}`
      ).toString(
        "base64"
      );

    const response =
      await fetch(
        `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(
          accountSid
        )}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Basic ${basicAuth}`,
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            form.toString(),
          cache: "no-store",
        }
      );

    const data =
      (await response
        .json()
        .catch(
          () => null
        )) as
        | {
            sid?: string;
            message?: string;
            code?: number;
          }
        | null;

    if (!response.ok) {
      const message =
        data?.message ??
        "Twilio rejected the SMS request.";

      console.error(
        "Twilio SMS failed:",
        {
          status:
            response.status,
          code:
            data?.code,
          message,
        }
      );

      return {
        success: false,
        error:
          message,
      };
    }

    return {
      success: true,
      messageSid:
        data?.sid,
    };
  } catch (error) {
    console.error(
      "SMS could not be sent:",
      error
    );

    return {
      success: false,
      error:
        error instanceof
          Error
          ? error.message
          : "SMS could not be sent.",
    };
  }
}

export interface SendResolvedSmsInput {
  phoneNumber: string;
  areaName: string;
  taskText: string;
}

export interface SendCreatedSmsInput {
  phoneNumber: string;
  areaName: string;
  taskText: string;
  raisedBy: string;
}

/*
 * Sends a one-way completion notification
 * back to the restricted Lajna / Ansar user
 * whose phone was attached to the task.
 *
 * Sender shown on the phone:
 *
 * Ijtema Site
 */
export async function sendUrgentTaskResolvedSms({
  phoneNumber,
  areaName,
  taskText,
}: SendResolvedSmsInput) {
  const message =
    `Resolved: ${areaName}. ${compactTaskText(
      taskText
    )}`;

  return sendSms(
    phoneNumber,
    message
  );
}

/*
 * Sends an immediate alert to the site/admin
 * phone when a Lajna or Ansar restricted user
 * raises a new urgent task.
 *
 * Sender shown on the phone:
 *
 * Ijtema Site
 */
export async function sendUrgentTaskCreatedSms({
  phoneNumber,
  areaName,
  taskText,
  raisedBy,
}: SendCreatedSmsInput) {
  const message =
    `New urgent task from ${raisedBy}: ${areaName}. ${compactTaskText(
      taskText,
      72
    )}`;

  return sendSms(
    phoneNumber,
    message
  );
}
