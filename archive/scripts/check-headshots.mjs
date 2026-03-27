import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dtnozcqkuzhjmjvsfjqk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bm96Y3FrdXpoam1qdnNmanFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDY4MzAsImV4cCI6MjA4MDQ4MjgzMH0.7puo2RCr6VMNNp_lywpAqufLEGnnE3TYqAtX8zQ0X8c'
);

const { data: byu, error: e1 } = await supabase.from('cbb_pitchers').select('name,headshot').eq('team_id','127').order('name');
console.log('BYU error:', e1?.message);
console.log('BYU count:', byu?.length);
console.log('BYU sample:', JSON.stringify(byu?.slice(0,3), null, 2));

const { data: duke, error: e2 } = await supabase.from('cbb_pitchers').select('name,headshot').eq('team_id','93').order('name');
console.log('\nDuke error:', e2?.message);
console.log('Duke count:', duke?.length);
console.log('Duke sample:', JSON.stringify(duke?.slice(0,3), null, 2));
