import pwPkg from '@playwright/test';
const { chromium } = pwPkg;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('\n🔍 Investigating Houston roster page...\n');

await page.goto('https://uhcougars.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);

await page.evaluate(() => window.scrollBy(0, 1000));
await page.waitForTimeout(3000);

const analysis = await page.evaluate(() => {
  const table = document.querySelector('table');

  if (!table) {
    return {
      hasTable: false,
      bodyText: document.body.innerText.substring(0, 1000),
      rosterDivs: document.querySelectorAll('[class*="roster"], [class*="player"]').length
    };
  }

  const rows = table.querySelectorAll('tbody tr');
  const samples = [];

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    const cells = [...row.querySelectorAll('td, th')];
    const cellData = cells.map((cell, idx) => ({
      index: idx,
      text: cell.textContent?.trim().substring(0, 100)
    }));

    samples.push({ rowIndex: i, cells: cellData });
  }

  return { hasTable: true, totalRows: rows.length, samples };
});

console.log('Analysis:', JSON.stringify(analysis, null, 2));

await browser.close();
