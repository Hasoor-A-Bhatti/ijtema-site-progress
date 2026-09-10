import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

import type {
  GeneratorFuelLog,
  GeneratorListResponse,
  GeneratorRatingHistoryEntry,
  SiteGenerator,
} from "@/types/generators";

interface GeneratorRow {
  id: string;
  name: string;
  x: number;
  y: number;
  kva: number;
  default_kva: number;
  description: string | null;
  sync_group: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  const [generatorsResult, fuelResult, ratingHistoryResult] = await Promise.all([
    supabaseServer
      .from("generators")
      .select(
        "id, name, x, y, kva, default_kva, description, sync_group, created_at, updated_at"
      )
      .order("name", { ascending: true }),
    supabaseServer
      .from("generator_fuel_logs")
      .select("id, generator_id, log_date, litres, created_at")
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("generator_rating_history")
      .select("id, generator_id, old_kva, new_kva, changed_at")
      .order("changed_at", { ascending: true }),
  ]);

  if (generatorsResult.error) {
    console.error("Failed to load generators:", generatorsResult.error);
    return NextResponse.json(
      { error: "Generator information could not be loaded." },
      { status: 500 }
    );
  }

  if (fuelResult.error) {
    console.error("Failed to load generator fuel logs:", fuelResult.error);
    return NextResponse.json(
      { error: "Generator fuel information could not be loaded." },
      { status: 500 }
    );
  }

  if (ratingHistoryResult.error) {
    console.error(
      "Failed to load generator rating history:",
      ratingHistoryResult.error
    );
    return NextResponse.json(
      { error: "Generator rating history could not be loaded." },
      { status: 500 }
    );
  }

  const fuelLogs = (fuelResult.data ?? []) as GeneratorFuelLog[];
  const ratingHistory = (ratingHistoryResult.data ?? []) as GeneratorRatingHistoryEntry[];

  const logsByGenerator = new Map<string, GeneratorFuelLog[]>();
  fuelLogs.forEach((log) => {
    const current = logsByGenerator.get(log.generator_id) ?? [];
    current.push(log);
    logsByGenerator.set(log.generator_id, current);
  });

  const ratingsByGenerator = new Map<string, GeneratorRatingHistoryEntry[]>();
  ratingHistory.forEach((entry) => {
    const current = ratingsByGenerator.get(entry.generator_id) ?? [];
    current.push(entry);
    ratingsByGenerator.set(entry.generator_id, current);
  });

  const generators: SiteGenerator[] = ((generatorsResult.data ?? []) as GeneratorRow[])
    .map((generator) => {
      const logs = logsByGenerator.get(generator.id) ?? [];

      return {
        ...generator,
        default_kva: Number(generator.default_kva ?? generator.kva),
        kva: Number(generator.kva),
        x: Number(generator.x),
        y: Number(generator.y),
        fuel_logs: logs,
        rating_history: ratingsByGenerator.get(generator.id) ?? [],
        total_fuel_litres: logs.reduce(
          (sum, log) => sum + Number(log.litres || 0),
          0
        ),
      };
    })
    .sort((a, b) => {
      const aNumber = Number(a.name.replace(/\D/g, ""));
      const bNumber = Number(b.name.replace(/\D/g, ""));
      return aNumber - bNumber;
    });

  const response: GeneratorListResponse = {
    success: true,
    generators,
    fleet: {
      totalGenerators: generators.length,
      totalKva: generators.reduce(
        (sum, generator) => sum + Number(generator.kva || 0),
        0
      ),
      totalFuelLitres: generators.reduce(
        (sum, generator) => sum + generator.total_fuel_litres,
        0
      ),
    },
  };

  return NextResponse.json(response);
}
