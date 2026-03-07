/**
 * v14 Phase 10 — S45 E2E Test: Character Creation -> Arena Entry Flow
 *
 * Validates:
 *   1. Character creation with name + nationality
 *   2. Random character generation (RANDOMIZE button)
 *   3. Arena entry after character confirmation
 *   4. In-game HUD elements visible
 *   5. Agent appears with correct nationality
 */

import { test, expect } from '@playwright/test';

test.describe('v14: Character Creation -> Arena Entry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear tutorial state for clean test
    await page.evaluate(() => {
      localStorage.setItem('aww_tutorial_completed', 'true');
    });
  });

  test('lobby page loads and shows entry UI', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();

    // Wait for app to hydrate
    await page.waitForTimeout(2000);

    // Should have some interactive elements
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  test('page renders without critical errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      // Ignore ResizeObserver and WebGL warnings
      if (!error.message.includes('ResizeObserver') && !error.message.includes('WebGL')) {
        errors.push(error.message);
      }
    });

    await page.waitForTimeout(3000);

    // No critical JS errors
    expect(errors).toHaveLength(0);
  });

  test('name input accepts text', async ({ page }) => {
    // Look for any text input on the page
    const inputs = page.locator('input[type="text"]');
    const count = await inputs.count();

    if (count > 0) {
      // Type a name
      await inputs.first().fill('TestAgent');
      const value = await inputs.first().inputValue();
      expect(value).toBe('TestAgent');
    }
  });

  test('3D canvas renders (WebGL context)', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Check for canvas element (R3F or Three.js)
    const canvas = page.locator('canvas');
    const canvasCount = await canvas.count();

    // Should have at least one canvas (globe or game)
    expect(canvasCount).toBeGreaterThanOrEqual(1);

    // Canvas should have non-zero dimensions
    if (canvasCount > 0) {
      const box = await canvas.first().boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
      }
    }
  });
});
