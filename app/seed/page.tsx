"use client";

import { useState } from "react";

import { siteAreas } from "@/data/siteAreas";
import { supabase } from "@/lib/supabase";

export default function SeedPage() {
  const [message, setMessage] = useState("");

  async function seedAreas() {
    setMessage("Adding site areas...");

    const rows = siteAreas.map((area) => ({
      id: area.id,
      name: area.name,
      area_type: area.type,
      status: area.status,
    }));

    const { data, error } = await supabase
      .from("site_areas")
      .upsert(rows, {
        onConflict: "id",
      })
      .select("id");

    if (error) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage(
      `Success — ${data?.length ?? 0} site areas are now in Supabase.`
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Seed Site Areas
      </h1>

      <p className="mt-2 text-slate-600">
        {siteAreas.length} areas found in siteAreas.ts
      </p>

      <button
        type="button"
        onClick={seedAreas}
        className="mt-6 rounded-lg bg-slate-900 px-5 py-3 font-medium text-white"
      >
        Add Areas to Supabase
      </button>

      {message && (
        <p className="mt-4 text-sm text-slate-700">
          {message}
        </p>
      )}
    </main>
  );
}