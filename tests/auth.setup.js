// @ts-check
/**
 * Auth Setup — runs ONCE before the E2E suite.
 * Logs in via the UI, saves storage state (localStorage token) to disk
 * so all subsequent tests skip the login page.
 */
const { test: setup, expect } = require('@playwright/test');
const path = require('path');

const EMAIL = 'rickykwhittaker.rw@gmail.com';
const PASSWORD = 'W4488253r!';
const STATE_FILE = path.join(__dirname, '.auth-state.json');

setup('authenticate', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    // If already on the tournament manager (token in storage), done
    const hasAppContent = await page.getByRole('button', { name: /roster|setup|schedule/i }).first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasAppContent) {
        console.log('[auth] Already authenticated — saving state');
        await page.context().storageState({ path: STATE_FILE });
        return;
    }

    // Fill login form
    if (process.env.MANUAL_LOGIN === 'true') {
        console.log('\n==================================================================');
        console.log('[auth] 🔑 MANUAL LOGIN INITIATED.');
        console.log('[auth] Please select the browser window, enter your account credentials,');
        console.log('[auth] and click "Log In" to proceed.');
        console.log('==================================================================\n');
        
        // Wait up to 120 seconds for the user to complete the login sequence manually
        await expect(page.getByRole('button', { name: /roster|setup|schedule/i }).first()).toBeVisible({ timeout: 120000 });
    } else {
        await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 8000 });
        await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
        await page.locator('input[type="password"]').first().fill(PASSWORD);
        await page.locator('button[type="submit"], button').filter({ hasText: /log in|sign in|login/i }).first().click();

        // Wait for redirect to main app
        await expect(page.getByRole('button', { name: /roster|setup|schedule/i }).first()).toBeVisible({ timeout: 15000 });
    }

    // Save auth state
    await page.context().storageState({ path: STATE_FILE });
    console.log('[auth] Logged in and state saved to', STATE_FILE);
});
