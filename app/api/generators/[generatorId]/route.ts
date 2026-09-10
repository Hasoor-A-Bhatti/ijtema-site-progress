import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import { supabaseServer } from "@/lib/supabaseServer";

interface RouteContext {
  params: Promise<{
    generatorId: string;
  }>;
}

async function requireEditor() {
  const authorised = await hasValidEditorSession();

  if (!authorised) {
    return NextResponse.json(
      { error: "Editing access is required." },
      { status: 401 }
    );
  }

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireEditor();
  if (denied) return denied;

  const { generatorId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { kva?: unknown }
    | null;

  const kva = Number(body?.kva);

  if (!Number.isFinite(kva) || kva <= 0 || kva > 5000) {
    return NextResponse.json(
      { error: "Enter a valid generator kVA rating." },
      { status: 400 }
    );
  }

  /*
   * The database RPC performs the current-rating update and history insert
   * in the same Postgres transaction. This prevents the generator rating
   * changing without a matching history record (or vice versa).
   */
  const { data, error } = await supabaseServer.rpc(
    "update_generator_kva_with_history",
    {
      p_generator_id: generatorId,
      p_new_kva: kva,
    }
  );

  if (error) {
    console.error("Failed to update generator rating:", error);

    if (error.message?.includes("Generator not found")) {
      return NextResponse.json(
        { error: "Generator not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Generator rating could not be saved." },
      { status: 500 }
    );
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    return NextResponse.json(
      { error: "Generator not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    generator: result,
  });
}

export async function POST(request: Request, context: RouteContext) {
  const denied = await requireEditor();
  if (denied) return denied;

  const { generatorId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { logDate?: unknown; litres?: unknown }
    | null;

  const logDate =
    typeof body?.logDate === "string" ? body.logDate.trim() : "";
  const litres = Number(body?.litres);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    return NextResponse.json(
      { error: "Choose a valid fuel date." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(litres) || litres <= 0 || litres > 100000) {
    return NextResponse.json(
      { error: "Enter a valid number of litres." },
      { status: 400 }
    );
  }

  const { data: generator, error: generatorError } = await supabaseServer
    .from("generators")
    .select("id")
    .eq("id", generatorId)
    .maybeSingle();

  if (generatorError) {
    console.error("Failed to check generator:", generatorError);
    return NextResponse.json(
      { error: "Generator could not be checked." },
      { status: 500 }
    );
  }

  if (!generator) {
    return NextResponse.json(
      { error: "Generator not found." },
      { status: 404 }
    );
  }

  const { data, error } = await supabaseServer
    .from("generator_fuel_logs")
    .insert({
      generator_id: generatorId,
      log_date: logDate,
      litres,
    })
    .select("id, generator_id, log_date, litres, created_at")
    .single();

  if (error) {
    console.error("Failed to add generator fuel:", error);
    return NextResponse.json(
      { error: "Fuel entry could not be saved." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, fuelLog: data });
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await requireEditor();
  if (denied) return denied;

  const { generatorId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { fuelLogId?: unknown }
    | null;

  const fuelLogId =
    typeof body?.fuelLogId === "string" ? body.fuelLogId.trim() : "";

  if (!fuelLogId) {
    return NextResponse.json(
      { error: "A fuel entry is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("generator_fuel_logs")
    .delete()
    .eq("id", fuelLogId)
    .eq("generator_id", generatorId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to delete generator fuel entry:", error);
    return NextResponse.json(
      { error: "Fuel entry could not be removed." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Fuel entry not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
