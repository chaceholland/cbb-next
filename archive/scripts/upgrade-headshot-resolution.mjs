/**
 * Upgrade all headshot URLs from 100x100 to 600x600 for better quality
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upgradeHeadshotResolution() {
  console.log('🔍 Fetching all pitchers with headshots...\n');

  // Get all pitchers with headshots
  const { data: pitchers, error } = await supabase
    .from('cbb_pitchers')
    .select('pitcher_id, name, display_name, headshot, team_id')
    .not('headshot', 'is', null);

  if (error) {
    console.error('❌ Error fetching pitchers:', error.message);
    return;
  }

  console.log(`📸 Found ${pitchers.length} pitchers with headshots\n`);

  let upgraded = 0;
  let skipped = 0;
  let errors = 0;

  for (const pitcher of pitchers) {
    const oldUrl = pitcher.headshot;

    // Check if URL contains size parameters
    if (oldUrl.includes('width=100') && oldUrl.includes('height=100')) {
      // Replace 100x100 with 600x600
      const newUrl = oldUrl
        .replace(/width=100/g, 'width=600')
        .replace(/height=100/g, 'height=600');

      // Update in database
      const { error: updateError } = await supabase
        .from('cbb_pitchers')
        .update({ headshot: newUrl })
        .eq('pitcher_id', pitcher.pitcher_id);

      if (updateError) {
        console.error(`❌ Error updating ${pitcher.display_name || pitcher.name}:`, updateError.message);
        errors++;
      } else {
        console.log(`✅ Upgraded: ${pitcher.display_name || pitcher.name}`);
        upgraded++;
      }
    } else {
      // URL doesn't have 100x100, skip
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Resolution upgrade complete!`);
  console.log(`   - ${upgraded} headshots upgraded to 600x600`);
  console.log(`   - ${skipped} headshots skipped (already high-res or no size params)`);
  if (errors > 0) {
    console.log(`   - ${errors} errors encountered`);
  }
  console.log('\n🔄 Redeploy to Vercel to see the improved quality!\n');
}

async function main() {
  console.log('🏀 Headshot Resolution Upgrade\n');
  console.log('='.repeat(60) + '\n');

  await upgradeHeadshotResolution();
}

main().catch(console.error);
