import type {
  DepartmentReport,
  ReportFormValues,
  ReportStatus,
} from "@/types/reports";

export const REPORT_TIME_ZONE = "Europe/London";
export const REPORT_DEADLINE_HOUR = 20;

/*
 * Fields completed manually by the department:
 *
 * 1. Team members on site
 * 2. Total manhours
 * 3. Today's activities
 * 4. Incidents / delays
 * 5. Work proposed for tomorrow
 * 6. Additional comments / highlights
 * 7. Signature — Name & AIMS ID
 *
 * Date, Department and Nazim are automatic metadata.
 */
export const REPORT_FIELD_COUNT = 7;

export function isValidReportDate(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/*
 * Finds the UTC offset for Europe/London
 * at a specific instant.
 *
 * This means the 20:00 deadline works
 * correctly during both GMT and BST.
 */
function getTimeZoneOffsetMs(
  date: Date,
  timeZone: string
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(date);

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map((part) => [
          part.type,
          Number(part.value),
        ])
    );

  const representedAsUtc =
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );

  return (
    representedAsUtc -
    date.getTime()
  );
}

/*
 * Creates the UTC timestamp corresponding
 * to 20:00 Europe/London on the report date.
 */
export function getReportDeadline(
  reportDate: string
) {
  const [year, month, day] =
    reportDate
      .split("-")
      .map(Number);

  const approximateUtc =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        REPORT_DEADLINE_HOUR,
        0,
        0
      )
    );

  const firstOffset =
    getTimeZoneOffsetMs(
      approximateUtc,
      REPORT_TIME_ZONE
    );

  let result =
    new Date(
      approximateUtc.getTime() -
        firstOffset
    );

  /*
   * Re-check in case the date falls close
   * to a daylight-saving transition.
   */
  const secondOffset =
    getTimeZoneOffsetMs(
      result,
      REPORT_TIME_ZONE
    );

  if (
    secondOffset !==
    firstOffset
  ) {
    result =
      new Date(
        approximateUtc.getTime() -
          secondOffset
      );
  }

  return result;
}

/*
 * Report status is derived rather than stored.
 *
 * Before deadline + no submission = Pending
 * After deadline + no submission  = Overdue
 * Submitted before deadline       = Completed
 * Submitted after deadline        = Late
 */
export function getReportStatus(
  report:
    | Pick<
        DepartmentReport,
        | "deadline_at"
        | "submitted_at"
      >
    | null,
  deadline: Date,
  now = new Date()
): ReportStatus {
  if (
    !report?.submitted_at
  ) {
    return now.getTime() >
      deadline.getTime()
      ? "overdue"
      : "pending";
  }

  const submittedAt =
    new Date(
      report.submitted_at
    );

  const actualDeadline =
    report.deadline_at
      ? new Date(
          report.deadline_at
        )
      : deadline;

  return (
    submittedAt.getTime() <=
    actualDeadline.getTime()
      ? "completed"
      : "late"
  );
}

function hasText(
  value:
    | string
    | null
    | undefined
) {
  return Boolean(
    value?.trim()
  );
}

/*
 * Used for the draft progress indicator.
 *
 * Drafts do not need all fields completed.
 */
export function countCompletedReportFields(
  report:
    | Partial<DepartmentReport>
    | null
) {
  if (!report) {
    return 0;
  }

  let completed = 0;

  if (
    typeof report.team_members_on_site ===
      "number" &&
    report.team_members_on_site >= 0
  ) {
    completed += 1;
  }

  if (
    typeof report.total_manhours ===
      "number" &&
    report.total_manhours >= 0
  ) {
    completed += 1;
  }

  if (
    hasText(
      report.todays_activities
    )
  ) {
    completed += 1;
  }

  if (
    hasText(
      report.incidents_delays
    )
  ) {
    completed += 1;
  }

  if (
    hasText(
      report.work_proposed_tomorrow
    )
  ) {
    completed += 1;
  }

  if (
    hasText(
      report.additional_comments
    )
  ) {
    completed += 1;
  }

  if (
    hasText(
      report.signature_name_aims_id
    )
  ) {
    completed += 1;
  }

  return completed;
}

/*
 * Validates a draft save.
 *
 * IMPORTANT:
 * Drafts are allowed to contain incomplete fields.
 *
 * Empty number inputs are stored as null.
 * Empty text inputs are stored as "".
 */
export function validateReportForm(
  body: unknown
):
  | {
      success: true;
      values: ReportFormValues;
    }
  | {
      success: false;
      error: string;
    } {
  if (
    typeof body !== "object" ||
    body === null
  ) {
    return {
      success: false,
      error:
        "Invalid report data.",
    };
  }

  const data =
    body as Record<
      string,
      unknown
    >;

  const teamMembers =
    data.team_members_on_site;

  const totalManhours =
    data.total_manhours;

  /*
   * Team members may be blank in a draft,
   * otherwise it must be a whole number >= 0.
   */
  if (
    teamMembers !== null &&
    (
      typeof teamMembers !==
        "number" ||
      !Number.isInteger(
        teamMembers
      ) ||
      teamMembers < 0
    )
  ) {
    return {
      success: false,
      error:
        "Number of team members must be a whole number of 0 or more.",
    };
  }

  /*
   * Manhours may be blank in a draft,
   * otherwise it must be a valid number >= 0.
   */
  if (
    totalManhours !== null &&
    (
      typeof totalManhours !==
        "number" ||
      !Number.isFinite(
        totalManhours
      ) ||
      totalManhours < 0
    )
  ) {
    return {
      success: false,
      error:
        "Total manhours must be 0 or more.",
    };
  }

  /*
   * Text fields are always sent as strings.
   * They may be empty while the report is a draft.
   */
  const textFields = [
    "todays_activities",
    "incidents_delays",
    "work_proposed_tomorrow",
    "additional_comments",
    "signature_name_aims_id",
  ] as const;

  for (
    const field of
    textFields
  ) {
    if (
      typeof data[field] !==
      "string"
    ) {
      return {
        success: false,
        error:
          "All report text fields must contain valid text.",
      };
    }
  }

  return {
    success: true,

    values: {
      team_members_on_site:
        teamMembers as
          | number
          | null,

      total_manhours:
        totalManhours as
          | number
          | null,

      todays_activities:
        (
          data.todays_activities as string
        ).trim(),

      incidents_delays:
        (
          data.incidents_delays as string
        ).trim(),

      work_proposed_tomorrow:
        (
          data.work_proposed_tomorrow as string
        ).trim(),

      additional_comments:
        (
          data.additional_comments as string
        ).trim(),

      signature_name_aims_id:
        (
          data.signature_name_aims_id as string
        ).trim(),
    },
  };
}

/*
 * Official submission validation.
 *
 * Unlike saving a draft, every reporting field
 * must be completed before submission.
 */
export function getSubmissionValidationError(
  report: DepartmentReport
) {
  if (
    typeof report.team_members_on_site !==
      "number" ||
    report.team_members_on_site < 0
  ) {
    return "Number of team members on site is required.";
  }

  if (
    typeof report.total_manhours !==
      "number" ||
    report.total_manhours < 0
  ) {
    return "Total manhours is required.";
  }

  if (
    !hasText(
      report.todays_activities
    )
  ) {
    return "Today's Activities is required.";
  }

  if (
    !hasText(
      report.incidents_delays
    )
  ) {
    return "Incidents / Delays is required. Enter 'None' if there were no incidents or delays.";
  }

  if (
    !hasText(
      report.work_proposed_tomorrow
    )
  ) {
    return "Work Proposed for Tomorrow is required.";
  }

  if (
    !hasText(
      report.additional_comments
    )
  ) {
    return "Additional Comments / Highlights is required. Enter 'None' if there are no additional comments.";
  }

  if (
    !hasText(
      report.signature_name_aims_id
    )
  ) {
    return "Signature is required. Enter your full name and AIMS ID.";
  }

  return null;
}