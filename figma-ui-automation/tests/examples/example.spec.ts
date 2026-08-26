import { test, expect } from '@playwright/test';

/**
 * Example spec — the codegen agent uses this (via framework-profile.json)
 * as the shape reference for generated specs. Replace with your real examples.
 */
test.describe('example screen', () => {
  test('renders the heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome/i }).first()).toBeVisible();
  });

  test('submits the form', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill('test@example.com');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });
});
