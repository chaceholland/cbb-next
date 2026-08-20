import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// "Follow" is a curation list separate from Favorites: players Chace wants
// collected onto the Follow tab, ticked from the Data Quality box on a
// pitcher card. Same shape/behaviour as /api/favorites (toggle on POST).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("cbb_follows").select("pitcher_id");

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

  const { data: existing } = await supabase
    .from("cbb_follows")
    .select("id")
    .eq("pitcher_id", pitcher_id)
    .single();

  if (existing) {
    await supabase.from("cbb_follows").delete().eq("pitcher_id", pitcher_id);
    return NextResponse.json({ pitcher_id, followed: false });
  }

  await supabase.from("cbb_follows").insert({ pitcher_id });
  return NextResponse.json({ pitcher_id, followed: true });
}
