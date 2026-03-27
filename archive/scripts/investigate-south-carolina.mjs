import pwPkg from '@playwright/test';
const { chromium } = pwPkg;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('\n🔍 Investigating South Carolina roster page...\n');

await page.goto('https://gamecocksonline.com/sports/baseball/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);

await page.evaluate(() => window.scrollBy(0, 1000));
await page.waitForTimeout(3000);

const tableData = await page.evaluate(() => {
  const table = document.querySelector('table');
  if (!table) return { error: 'No table found' };

  const rows = table.querySelectorAll('tbody tr');
  const samples = [];

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const cells = [...row.querySelectorAll('td, th')];
    const cellData = cells.map((cell, idx) => ({
      index: idx,
      text: cell.textContent?.trim().substring(0, 100)
    }));

    samples.push({ rowIndex: i, cells: cellData });
  }

  return { totalRows: rows.length, samples };
});

console.log('Total rows:', tableData.totalRows);
console.log('\nFirst 10 rows:\n');

tableData.samples.forEach(row => {
  console.log(`\n--- Row ${row.rowIndex} ---`);
  row.cells.forEach(cell => {
    if (cell.text) {
      console.log(`  Cell ${cell.index}: ${cell.text}`);
    }
  });
});

await browser.close();
