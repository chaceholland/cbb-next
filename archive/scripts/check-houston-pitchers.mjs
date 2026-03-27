import pwPkg from '@playwright/test';
const { chromium } = pwPkg;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('https://uhcougars.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);

const pitcherRows = await page.evaluate(() => {
  const table = document.querySelector('table');
  if (!table) return [];

  const rows = table.querySelectorAll('tbody tr');
  const pitchers = [];

  rows.forEach(row => {
    const cells = [...row.querySelectorAll('td, th')];
    if (cells.length >= 4) {
      const position = cells[3]?.textContent?.trim();
      if (position && (position.includes('RHP') || position.includes('LHP') || position === 'P' || position.toLowerCase().includes('pitcher'))) {
        pitchers.push({
          jersey: cells[0]?.textContent?.trim(),
          name: cells[1]?.textContent?.trim(),
          year: cells[2]?.textContent?.trim(),
          position: position,
          batsThrows: cells[4]?.textContent?.trim(),
          height: cells[5]?.textContent?.trim(),
          weight: cells[6]?.textContent?.trim(),
          hometown: cells[7]?.textContent?.trim()
        });
      }
    }
  });

  return pitchers;
});

console.log(`Found ${pitcherRows.length} pitchers:\n`);
pitcherRows.slice(0, 5).forEach(p => {
  console.log(`${p.name} (${p.position})`);
  console.log(`  Year: ${p.year}, Height: ${p.height}, Weight: ${p.weight}`);
  console.log(`  Hometown: ${p.hometown}, B/T: ${p.batsThrows}\n`);
});

await browser.close();
