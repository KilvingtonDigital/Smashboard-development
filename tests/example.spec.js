// @ts-check
const { test, expect } = require('@playwright/test');

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/DinkSync/i);
});

test('can create a tournament', async ({ page }) => {
    await page.goto('/');

    // Check if we are on the setup page
    await expect(page.locator('button').filter({ hasText: 'Setup' })).toBeVisible();

    // Fill in tournament name
    // Note: Adjust selectors based on actual app structure
    const nameInput = page.getByLabel(/Tournament Name/i);
    if (await nameInput.isVisible()) {
        await nameInput.fill('Test Tournament');
    }
});
