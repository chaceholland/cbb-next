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
    .from("cbb_game_favorites")
    .select("game_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data.map((r) => r.game_id));
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const { game_id } = await request.json();

  if (!game_id) {
    return NextResponse.json({ error: "game_id required" }, { status: 400 });
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from("cbb_game_favorites")
    .select("id")
    .eq("game_id", game_id)
    .single();

  if (existing) {
    // Remove
    await supabase.from("cbb_game_favorites").delete().eq("game_id", game_id);
    return NextResponse.json({ game_id, favorited: false });
  } else {
    // Add
    await supabase.from("cbb_game_favorites").insert({ game_id });
    return NextResponse.json({ game_id, favorited: true });
  }
}
