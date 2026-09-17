import { expect, test } from '@playwright/test';

test('public pages render and repository files remain private', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MarcsMusic/);
  await expect(page.getByRole('link', { name: /boeken/i }).first()).toBeVisible();

  await page.goto('/booking');
  await expect(page.getByRole('heading', { name: /Muziek die het moment draagt/i })).toBeVisible();

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /MarcsMusic Admin/i })).toBeVisible();

  for (const path of ['/server.js', '/package.json', '/.gitignore', '/data/bookings.json']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
