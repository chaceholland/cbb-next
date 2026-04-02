import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("cbb_favorites")
    .select("pitcher_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data.map((r) => r.pitcher_id));
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const { pitcher_id } = await request.json();

  if (!pitcher_id) {
    return NextResponse.json({ error: "pitcher_id required" }, { status: 400 });
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from("cbb_favorites")
    .select("id")
    .eq("pitcher_id", pitcher_id)
    .single();

  if (existing) {
    // Remove
    await supabase.from("cbb_favorites").delete().eq("pitcher_id", pitcher_id);
    return NextResponse.json({ pitcher_id, favorited: false });
  } else {
    // Add
    await supabase.from("cbb_favorites").insert({ pitcher_id });
    return NextResponse.json({ pitcher_id, favorited: true });
  }
}
