import pwPkg from '@playwright/test';
const { chromium } = pwPkg;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('\n🔍 Investigating Duke roster page...\n');

await page.goto('https://goduke.com/sports/baseball/roster', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(5000);

await page.evaluate(() => window.scrollBy(0, 1000));
await page.waitForTimeout(3000);

const analysis = await page.evaluate(() => {
  const table = document.querySelector('table');
  const bodyText = document.body.innerText;

  const hasPitcherText = bodyText.includes('RHP') || bodyText.includes('LHP') || bodyText.includes('Pitcher');

  // Look for roster containers
  const rosterDivs = document.querySelectorAll('[class*="roster"], [class*="player"], [class*="athlete"]');

  return {
    hasTable: !!table,
    tableRowCount: table ? table.querySelectorAll('tbody tr').length : 0,
    hasPitcherText: hasPitcherText,
    rosterDivCount: rosterDivs.length,
    textSample: bodyText.substring(0, 1500)
  };
});

console.log('Has table:', analysis.hasTable);
console.log('Table rows:', analysis.tableRowCount);
console.log('Has pitcher text:', analysis.hasPitcherText);
console.log('Roster divs:', analysis.rosterDivCount);
console.log('\nText sample:', analysis.textSample);

await browser.close();
