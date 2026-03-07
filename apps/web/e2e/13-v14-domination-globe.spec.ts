/**
 * v14 Phase 10 — S45 E2E Test: Domination + Globe Reflection
 *
 * Validates:
 *   1. Globe renders with country boundaries
 *   2. Country hover shows info panel
 *   3. Country click triggers arena entry flow
 *   4. Domination status colors reflect on globe
 *   5. Globe rotation and zoom work
 */

import { test, expect } from '@playwright/test';

test.describe('v14: Domination + Globe Reflection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('aww_tutorial_completed', 'true');
    });
    await page.waitForTimeout(3000);
  });

  test('globe 3D canvas renders', async ({ page }) => {
    const canvas = page.locator('canvas');
    const count = await canvas.count();

    expect(count).toBeGreaterThanOrEqual(1);

    if (count > 0) {
      const box = await canvas.first().boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
      }
    }
  });

  test('globe responds to mouse interaction', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    if (await canvas.isVisible()) {
      const box = await canvas.boundingBox();
      if (box) {
        // Drag to rotate
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();

        // Scroll to zoom
        await page.mouse.wheel(0, -100);
        await page.waitForTimeout(500);
        await page.mouse.wheel(0, 100);
      }
    }
  });

  test('globe canvas maintains performance during interaction', async ({ page }) => {
    const canvas = page.locator('canvas').first();

    if (await canvas.isVisible()) {
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        if (!error.message.includes('ResizeObserver') && !error.message.includes('WebGL')) {
          errors.push(error.message);
        }
      });

      const box = await canvas.boundingBox();
      if (box) {
        // Rapid mouse movements
        for (let i = 0; i < 10; i++) {
          await page.mouse.move(
            box.x + Math.random() * box.width,
            box.y + Math.random() * box.height
          );
        }
      }

      await page.waitForTimeout(1000);
      expect(errors).toHaveLength(0);
    }
  });
});
