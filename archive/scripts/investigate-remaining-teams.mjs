import pwPkg from '@playwright/test';
const { chromium } = pwPkg;

const TEAMS = [
  { name: 'California', url: 'https://calbears.com/sports/baseball/roster' },
  { name: 'Texas A&M', url: 'https://12thman.com/sports/baseball/roster' },
  { name: 'Arizona', url: 'https://arizonawildcats.com/sports/baseball/roster' }
];

const browser = await chromium.launch({ headless: true });

for (const team of TEAMS) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 Investigating ${team.name}...`);
  console.log(`URL: ${team.url}\n`);

  const page = await browser.newPage();

  try {
    await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    const analysis = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return { hasTable: false };

      const rows = table.querySelectorAll('tbody tr');
      const samples = [];

      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        const cells = [...row.querySelectorAll('td, th')];
        const cellData = cells.map((cell, idx) => ({
          index: idx,
          text: cell.textContent?.trim().substring(0, 80),
          html: cell.innerHTML.substring(0, 100)
        }));

        samples.push({ rowIndex: i, cells: cellData });
      }

      return { hasTable: true, totalRows: rows.length, samples };
    });

    if (!analysis.hasTable) {
      console.log('❌ No table found on page\n');
    } else {
      console.log(`✅ Table found with ${analysis.totalRows} rows\n`);

      analysis.samples.forEach(row => {
        console.log(`Row ${row.rowIndex}:`);
        row.cells.forEach(cell => {
          if (cell.text) {
            console.log(`  [${cell.index}] ${cell.text}`);
          }
        });
        console.log('');
      });
    }

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
