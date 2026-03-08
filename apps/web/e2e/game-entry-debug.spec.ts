import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9001';

test.describe.configure({ mode: 'serial' });

test.describe('Game Entry Debug — Globe → Arena Flow', () => {
  test('1. Lobby page loads with globe', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`PAGE_ERROR: ${err.message}`));

    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // Wait for hydration + globe mount
    await page.waitForTimeout(4000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const divCount = await page.locator('div').count();
    const canvasCount = await page.locator('canvas').count();

    console.log('=== LOBBY STATE ===');
    console.log(`DIVs: ${divCount}, Canvas: ${canvasCount}`);
    console.log(`Body text (first 500): ${bodyText.substring(0, 500)}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach(e => console.log(`  ERROR: ${e.substring(0, 200)}`));

    expect(divCount).toBeGreaterThan(3);
  });

  test('2. Find country panel / enter arena button', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`PAGE_ERROR: ${err.message}`));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Check for WebSocket connection
    const wsConnected = await page.evaluate(() => {
      // Check if socket is available in window
      return document.body.innerText.includes('Online') ||
             document.body.innerText.includes('online') ||
             document.body.innerText.includes('Connected') ||
             document.body.innerText.includes('players');
    });
    console.log(`WebSocket indicator found: ${wsConnected}`);

    // Look for any clickable elements on globe (country panels, buttons)
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`=== LOBBY TEXT ===\n${bodyText.substring(0, 1000)}`);

    // Try to find Enter Arena / Join / Battle buttons
    const enterBtn = page.locator('text=/enter|arena|battle|join|fight|전투|참전|입장/i');
    const enterBtnCount = await enterBtn.count();
    console.log(`"Enter/Arena/Battle" buttons found: ${enterBtnCount}`);

    // Try clicking on the globe canvas to trigger country selection
    const canvas = page.locator('canvas').first();
    if (await canvas.count() > 0) {
      const box = await canvas.boundingBox();
      if (box) {
        // Click center of globe
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);

        const afterClickText = await page.evaluate(() => document.body.innerText);
        console.log(`=== AFTER GLOBE CLICK ===\n${afterClickText.substring(0, 1000)}`);

        // Check if country panel appeared
        const hasCountryPanel = afterClickText.includes('Enter') ||
                               afterClickText.includes('Arena') ||
                               afterClickText.includes('Battle') ||
                               afterClickText.includes('전투') ||
                               afterClickText.includes('Tier');
        console.log(`Country panel appeared: ${hasCountryPanel}`);
      }
    }
  });

  test('3. Enter arena and check game rendering', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Click globe center to select a country
    const canvas = page.locator('canvas').first();
    if (await canvas.count() > 0) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(2000);
      }
    }

    // Look for any Enter/Join button and click it
    const possibleButtons = [
      page.locator('text=/Enter Arena/i'),
      page.locator('text=/Join Battle/i'),
      page.locator('text=/Enter/i'),
      page.locator('text=/전투 참가/i'),
      page.locator('text=/입장/i'),
      page.locator('div[style*="cursor: pointer"]'),
      page.locator('button'),
    ];

    let clicked = false;
    for (const btn of possibleButtons) {
      const count = await btn.count();
      if (count > 0) {
        const text = await btn.first().innerText().catch(() => '(no text)');
        console.log(`Found clickable: "${text}" (${count} matches)`);
        await btn.first().click();
        clicked = true;
        break;
      }
    }
    console.log(`Clicked enter button: ${clicked}`);

    // Wait for transition
    await page.waitForTimeout(5000);

    // Check game state
    const afterText = await page.evaluate(() => document.body.innerText);
    const afterCanvasCount = await page.locator('canvas').count();
    const afterHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));

    console.log('=== AFTER ENTER ARENA ===');
    console.log(`Canvas count: ${afterCanvasCount}`);
    console.log(`Body text (first 800): ${afterText.substring(0, 800)}`);

    // Check for game HUD elements
    const hasGameHUD = afterText.includes('HP') ||
                      afterText.includes('Wave') ||
                      afterText.includes('Lv') ||
                      afterText.includes('WASD') ||
                      afterText.includes('Kill') ||
                      afterText.includes('XP') ||
                      afterText.includes('Timer') ||
                      afterText.includes('Round');
    console.log(`Game HUD visible: ${hasGameHUD}`);

    // Check for arena mode indicators
    const hasArenaMode = afterHTML.includes('MCTerrain') ||
                        afterHTML.includes('arena') ||
                        afterHTML.includes('mc-terrain');
    console.log(`Arena mode indicators: ${hasArenaMode}`);

    // Report all JS errors
    console.log(`\n=== JS ERRORS (${consoleErrors.length}) ===`);
    consoleErrors.forEach(e => console.log(`  ${e.substring(0, 300)}`));
    console.log(`\n=== PAGE ERRORS (${pageErrors.length}) ===`);
    pageErrors.forEach(e => console.log(`  ${e.substring(0, 300)}`));

    // Check for fatal errors (exclude WebGL/hydration)
    const fatalErrors = pageErrors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('WebGL') &&
      !e.includes('context lost') &&
      !e.includes('THREE') &&
      !e.includes('hydration') &&
      !e.includes('Hydration')
    );
    console.log(`Fatal errors: ${fatalErrors.length}`);
    fatalErrors.forEach(e => console.log(`  FATAL: ${e.substring(0, 300)}`));
  });

  test('4. Direct WebSocket test — join country arena', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Inject test to check socket provider state
    const socketState = await page.evaluate(() => {
      // Traverse React fiber tree to find socket state
      const root = document.getElementById('__next') || document.body.children[0];
      // Check various global state indicators
      return {
        hasSocketIO: typeof (window as any).io !== 'undefined',
        bodyChildCount: document.body.children.length,
        divCount: document.querySelectorAll('div').length,
        canvasCount: document.querySelectorAll('canvas').length,
        innerTextPreview: document.body.innerText.substring(0, 300),
      };
    });
    console.log('=== SOCKET STATE ===');
    console.log(JSON.stringify(socketState, null, 2));
  });

  test('5. Check for JS errors on page load with 10s wait', async ({ page }) => {
    const allLogs: string[] = [];
    const errors: string[] = [];

    page.on('console', (msg) => {
      allLogs.push(`[${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`));

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    console.log(`=== ALL CONSOLE (${allLogs.length} entries) ===`);
    allLogs.slice(0, 30).forEach(l => console.log(`  ${l.substring(0, 200)}`));
    if (allLogs.length > 30) console.log(`  ... (${allLogs.length - 30} more)`);

    console.log(`\n=== ERRORS (${errors.length}) ===`);
    errors.forEach(e => console.log(`  ${e.substring(0, 300)}`));
  });
});
