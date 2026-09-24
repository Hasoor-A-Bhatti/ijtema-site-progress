import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "ijtema_amoomi_access";
const SESSION_SECONDS = 60 * 60 * 12;

type Role = "viewer" | "admin";

interface Session {
  role: Role;
  expiresAt: number;
}

function secret() {
  const value =
    process.env.AMOOMI_SESSION_SECRET ??
    process.env.EDITOR_SESSION_SECRET;

  if (!value || value.length < 24) {
    throw new Error(
      "Add AMOOMI_SESSION_SECRET (or configure EDITOR_SESSION_SECRET) with at least 24 characters."
    );
  }

  return value;
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");

  return (
    aa.length === bb.length &&
    timingSafeEqual(aa, bb)
  );
}

function signature(value: string) {
  return createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
}

function createToken(role: Role) {
  const payload: Session = {
    role,
    expiresAt:
      Date.now() +
      SESSION_SECONDS * 1000,
  };

  const encoded = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  return `${encoded}.${signature(encoded)}`;
}

function verifyToken(
  token: string | undefined
): Session | null {
  if (!token) return null;

  const [encoded, supplied] =
    token.split(".");

  if (!encoded || !supplied) {
    return null;
  }

  let expected: string;

  try {
    expected = signature(encoded);
  } catch {
    return null;
  }

  if (!safeEqual(supplied, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(
        encoded,
        "base64url"
      ).toString("utf8")
    ) as Session;

    if (
      (payload.role !== "viewer" &&
        payload.role !== "admin") ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function getSession() {
  const store = await cookies();
  return verifyToken(
    store.get(COOKIE)?.value
  );
}

function clean(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

async function loadPosts() {
  const [posts, officers, urgent] =
    await Promise.all([
      supabaseServer
        .from("amoomi_posts")
        .select(
          "id, name, x, y, sort_order"
        )
        .order("sort_order", {
          ascending: true,
        }),

      supabaseServer
        .from("amoomi_officers")
        .select(
          "id, post_id, name, phone, active, is_shift_incharge, deployed_at, updated_at"
        )
        .order("updated_at", {
          ascending: false,
        }),

      supabaseServer
        .from("amoomi_urgent_messages")
        .select(
          "id, post_id, message, incident_type, resolved, created_at, resolved_at"
        )
        .order("created_at", {
          ascending: false,
        }),
    ]);

  if (posts.error) throw posts.error;
  if (officers.error) throw officers.error;
  if (urgent.error) throw urgent.error;

  const officerRows =
    officers.data ?? [];

  const urgentRows =
    urgent.data ?? [];

  const activeOfficerRows =
    officerRows.filter(
      (officer) =>
        officer.active
    );

  const rememberedOfficerMap =
    new Map<
      string,
      {
        name: string;
        phone: string | null;
      }
    >();

  for (const officer of officerRows) {
    const normalisedPhone =
      officer.phone
        ?.replace(/\s+/g, "")
        .toLowerCase() ??
      "";

    const key =
      normalisedPhone ||
      officer.name
        .trim()
        .toLowerCase();

    if (
      key &&
      !rememberedOfficerMap.has(
        key
      )
    ) {
      rememberedOfficerMap.set(
        key,
        {
          name:
            officer.name,
          phone:
            officer.phone,
        }
      );
    }
  }

  const rememberedOfficers =
    Array.from(
      rememberedOfficerMap.values()
    ).sort(
      (first, second) =>
        first.name.localeCompare(
          second.name
        )
    );

  const postRows =
    (posts.data ?? []).map(
      (post) => {
        const postOfficers =
          activeOfficerRows.filter(
            (officer) =>
              officer.post_id === post.id
          );

        const postUrgent =
          urgentRows.filter(
            (message) =>
              message.post_id === post.id
          );

        return {
          ...post,
          officers: postOfficers,
          urgentMessages: postUrgent,
          unresolvedUrgentCount:
            postUrgent.filter(
              (message) =>
                !message.resolved
            ).length,
        };
      }
    );

  return {
    posts: postRows,
    rememberedOfficers,
  };
}

export async function GET() {
  const session =
    await getSession();

  if (!session) {
    return NextResponse.json({
      authorised: false,
      role: null,
      posts: [],
    });
  }

  try {
    const {
      posts,
      rememberedOfficers,
    } =
      await loadPosts();

    return NextResponse.json({
      authorised: true,
      role: session.role,
      posts,
      rememberedOfficers,
    });
  } catch (error) {
    console.error(
      "Failed to load Amoomi posts:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Amoomi post information could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  let body: Record<
    string,
    unknown
  >;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const action = clean(body.action);

  if (action === "login") {
    const role = clean(body.role);
    const password = clean(body.password);

    if (
      role !== "viewer" &&
      role !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Choose Viewer or Admin access.",
        },
        { status: 400 }
      );
    }

    const expected =
      role === "admin"
        ? process.env
            .AMOOMI_ADMIN_PASSWORD
        : process.env
            .AMOOMI_VIEWER_PASSWORD;

    if (!expected) {
      return NextResponse.json(
        {
          error:
            role === "admin"
              ? "AMOOMI_ADMIN_PASSWORD is not configured."
              : "AMOOMI_VIEWER_PASSWORD is not configured.",
        },
        { status: 500 }
      );
    }

    if (
      !safeEqual(password, expected)
    ) {
      return NextResponse.json(
        {
          error:
            "Incorrect Amoomi password.",
        },
        { status: 401 }
      );
    }

    const response =
      NextResponse.json({
        success: true,
        authorised: true,
        role,
      });

    response.cookies.set({
      name: COOKIE,
      value: createToken(
        role as Role
      ),
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });

    return response;
  }

  const session =
    await getSession();

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Amoomi access is required.",
      },
      { status: 401 }
    );
  }

  if (action === "addUrgent") {
    const postId = clean(body.postId);
    const message = clean(body.message);

    if (!postId || !message) {
      return NextResponse.json(
        {
          error:
            "Post and urgent message are required.",
        },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        {
          error:
            "Urgent messages are limited to 500 characters.",
        },
        { status: 400 }
      );
    }

    const result =
      await supabaseServer
        .from(
          "amoomi_urgent_messages"
        )
        .insert({
          post_id: postId,
          message,
          incident_type: "urgent",
          resolved: false,
          created_by_role:
            session.role,
        });

    if (result.error) {
      console.error(
        "Failed to add Amoomi urgent message:",
        result.error
      );

      return NextResponse.json(
        {
          error:
            "The urgent message could not be saved.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  if (
    action === "addSecurityBreach"
  ) {
    const postId = clean(body.postId);

    const message =
      clean(body.message) ||
      "Security breach reported.";

    if (!postId) {
      return NextResponse.json(
        {
          error:
            "Post is required.",
        },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        {
          error:
            "Security breach messages are limited to 500 characters.",
        },
        { status: 400 }
      );
    }

    const result =
      await supabaseServer
        .from(
          "amoomi_urgent_messages"
        )
        .insert({
          post_id: postId,
          message,
          incident_type:
            "security_breach",
          resolved: false,
          created_by_role:
            session.role,
        });

    if (result.error) {
      console.error(
        "Failed to add Amoomi security breach:",
        result.error
      );

      return NextResponse.json(
        {
          error:
            "The security breach could not be raised.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  if (session.role !== "admin") {
    return NextResponse.json(
      {
        error:
          "Amoomi Admin access is required for this action.",
      },
      { status: 403 }
    );
  }

  if (action === "addOfficer") {
    const postId = clean(body.postId);
    const name = clean(body.name);
    const phone = clean(body.phone);

    if (!postId || !name) {
      return NextResponse.json(
        {
          error:
            "Officer name and post are required.",
        },
        { status: 400 }
      );
    }

    const result =
      await supabaseServer
        .from("amoomi_officers")
        .insert({
          post_id: postId,
          name,
          phone: phone || null,
          active: true,
          is_shift_incharge: false,
        });

    if (result.error) {
      console.error(
        "Failed to deploy Amoomi officer:",
        result.error
      );

      return NextResponse.json(
        {
          error:
            "The officer could not be deployed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  if (action === "setShiftIncharge") {
    const officerId = clean(body.officerId);
    const postId = clean(body.postId);

    if (!officerId || !postId) {
      return NextResponse.json(
        { error: "Officer and post are required." },
        { status: 400 }
      );
    }

    const existing =
      await supabaseServer
        .from("amoomi_officers")
        .select("id, name, post_id")
        .eq("active", true)
        .eq("is_shift_incharge", true)
        .neq("id", officerId)
        .limit(1);

    if (existing.error) {
      return NextResponse.json(
        { error: "Could not check the current Shift Incharge." },
        { status: 500 }
      );
    }

    if ((existing.data ?? []).length > 0) {
      return NextResponse.json(
        {
          error:
            "A Shift Incharge is already deployed. Demote the current Shift Incharge before assigning another officer.",
        },
        { status: 409 }
      );
    }

    const result =
      await supabaseServer
        .from("amoomi_officers")
        .update({
          is_shift_incharge: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", officerId)
        .eq("post_id", postId)
        .eq("active", true);

    if (result.error) {
      return NextResponse.json(
        { error: "The Shift Incharge could not be set." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "demoteShiftIncharge") {
    const officerId = clean(body.officerId);

    if (!officerId) {
      return NextResponse.json(
        { error: "Officer is required." },
        { status: 400 }
      );
    }

    const result =
      await supabaseServer
        .from("amoomi_officers")
        .update({
          is_shift_incharge: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", officerId)
        .eq("active", true)
        .eq("is_shift_incharge", true);

    if (result.error) {
      return NextResponse.json(
        { error: "The Shift Incharge could not be demoted." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "removeOfficer") {
    const officerId =
      clean(body.officerId);

    if (!officerId) {
      return NextResponse.json(
        { error: "Officer is required." },
        { status: 400 }
      );
    }

    const currentOfficer =
      await supabaseServer
        .from("amoomi_officers")
        .select("id, is_shift_incharge")
        .eq("id", officerId)
        .eq("active", true)
        .maybeSingle();

    if (currentOfficer.data?.is_shift_incharge) {
      return NextResponse.json(
        { error: "Demote the Shift Incharge before removing them from duty." },
        { status: 409 }
      );
    }

    const result =
      await supabaseServer
        .from("amoomi_officers")
        .update({
          active: false,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", officerId)
        .eq("active", true);

    if (result.error) {
      console.error(
        "Failed to remove Amoomi officer:",
        result.error
      );

      return NextResponse.json(
        {
          error:
            "The officer could not be removed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  if (action === "transferOfficer") {
    const officerId =
      clean(body.officerId);

    const toPostId =
      clean(body.toPostId);

    if (!officerId || !toPostId) {
      return NextResponse.json(
        {
          error:
            "Officer and destination post are required.",
        },
        { status: 400 }
      );
    }

    const lookup =
      await supabaseServer
        .from("amoomi_officers")
        .select(
          "id, post_id, active, is_shift_incharge"
        )
        .eq("id", officerId)
        .maybeSingle();

    if (
      lookup.error ||
      !lookup.data ||
      !lookup.data.active
    ) {
      return NextResponse.json(
        {
          error:
            "The active officer could not be found.",
        },
        { status: 404 }
      );
    }

    if (lookup.data.is_shift_incharge) {
      return NextResponse.json(
        { error: "Demote the Shift Incharge before transferring them to another post." },
        { status: 409 }
      );
    }

    if (
      lookup.data.post_id ===
      toPostId
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a different destination post.",
        },
        { status: 400 }
      );
    }

    const now =
      new Date().toISOString();

    const transfer =
      await supabaseServer
        .from("amoomi_officers")
        .update({
          post_id: toPostId,
          updated_at: now,
        })
        .eq("id", officerId)
        .eq("active", true);

    if (transfer.error) {
      console.error(
        "Failed to transfer Amoomi officer:",
        transfer.error
      );

      return NextResponse.json(
        {
          error:
            "The officer could not be transferred.",
        },
        { status: 500 }
      );
    }

    const history =
      await supabaseServer
        .from(
          "amoomi_officer_movements"
        )
        .insert({
          officer_id: officerId,
          from_post_id:
            lookup.data.post_id,
          to_post_id: toPostId,
          moved_at: now,
        });

    if (history.error) {
      console.error(
        "Officer transferred but movement history could not be recorded:",
        history.error
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  if (action === "resolveUrgent") {
    const urgentId =
      clean(body.urgentId);

    if (!urgentId) {
      return NextResponse.json(
        {
          error:
            "Urgent message is required.",
        },
        { status: 400 }
      );
    }

    const result =
      await supabaseServer
        .from(
          "amoomi_urgent_messages"
        )
        .update({
          resolved: true,
          resolved_at:
            new Date().toISOString(),
        })
        .eq("id", urgentId)
        .eq("resolved", false);

    if (result.error) {
      console.error(
        "Failed to resolve Amoomi urgent message:",
        result.error
      );

      return NextResponse.json(
        {
          error:
            "The urgent message could not be resolved.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  }

  return NextResponse.json(
    { error: "Unknown Amoomi action." },
    { status: 400 }
  );
}

export async function DELETE() {
  const response =
    NextResponse.json({
      success: true,
    });

  response.cookies.set({
    name: COOKIE,
    value: "",
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
