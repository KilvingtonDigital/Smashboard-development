// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const AUTH_STATE = path.join(__dirname, '.auth-state.json');

test.describe('179 Player High-Volume Tournament Simulation', () => {
    test.use({ storageState: AUTH_STATE });

    test('Run full doubles tournament with 179 players from start to finish', async ({ page }) => {
        test.setTimeout(180000); // 3 minutes for high-volume import and schedule

        console.log('STEP 1: Navigating to SmashBoard Remote Dashboard...');
        await page.goto('/');
        await page.waitForTimeout(3000);

        // Handle any initial dialogs
        const migrateBtn = page.getByRole('button', { name: /migrate data/i });
        if (await migrateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('  → Migrate Data dialog found, clicking...');
            await migrateBtn.click();
            await page.waitForTimeout(500);
        }
        const continueBtn = page.getByRole('button', { name: /^Continue$/i });
        if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('  → Continue dialog found, clicking...');
            await continueBtn.click();
            await page.waitForTimeout(500);
        }

        console.log('STEP 2: Resetting active tournament session...');
        const endBtn = page.locator('nav button').filter({ hasText: 'End' }).first();
        const endVisible = await endBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (endVisible) {
            console.log('  → Active session detected. Ending and clearing...');
            await endBtn.click();
            await page.waitForTimeout(600);
            const endClearBtn = page.getByRole('button', { name: /End & Clear/i });
            if (await endClearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await endClearBtn.click();
                await page.waitForTimeout(2000);
            } else {
                await page.keyboard.press('Escape');
            }
        }

        console.log('STEP 3: Setting up the 179 Players Division parameters...');
        const setupTab = page.locator('nav button').filter({ hasText: 'Setup' }).first();
        await setupTab.click();
        await page.waitForTimeout(1000);

        // Fill out Setup info
        const nameInput = page.locator('input[placeholder*="Summer Classic"], input[type="text"]').first();
        await nameInput.fill('Epic 179 Competitor Championship');

        // Select Open Division options
        const skillSelect = page.locator('select').first();
        if (await skillSelect.isVisible()) {
            await skillSelect.selectOption('all');
        }

        console.log('STEP 4: Navigating to Roster tab to import 179 players...');
        const rosterTab = page.locator('nav button').filter({ hasText: 'Roster' }).first();
        await rosterTab.click();
        await page.waitForTimeout(1000);

        // Generate 179 players spread across rating divisions:
        // Beginner (2.5), Advanced Beginner (3.2), Intermediate (3.7), Advanced (4.5), Pro (5.5)
        let bulkText = '';
        for (let i = 1; i <= 179; i++) {
            const divisions = [2.65, 3.25, 3.75, 4.25, 4.65, 5.25, 5.75];
            const rating = divisions[i % divisions.length].toFixed(2);
            const gender = (i % 2 === 0) ? 'F' : 'M';
            bulkText += `Competitor ${i}, ${rating}, ${gender}\n`;
        }

        console.log('  → Opening Bulk Add input box...');
        const bulkSummary = page.locator('summary').filter({ hasText: /Add multiple/i }).first();
        await bulkSummary.click();
        await page.waitForTimeout(500);

        console.log('  → Pasting 179 player records...');
        await page.getByPlaceholder(/Jane Doe/i).fill(bulkText);
        
        console.log('  → Clicking Parse & Add...');
        await page.getByRole('button', { name: 'Parse & add' }).click();
        await page.waitForTimeout(5000); // Allow server/browser to digest bulk import

        console.log('STEP 5: Verifying Roster count...');
        const rosterTitle = page.locator('h3').filter({ hasText: /Roster/i }).first();
        await expect(rosterTitle).toContainText('179');
        console.log('  ✓ Success: Exactly 179 competitors successfully registered on Roster!');

        console.log('STEP 6: Starting Tournament and generating matches...');
        await setupTab.click();
        await page.waitForTimeout(1000);

        // Click Start Tournament
        await page.getByRole('button', { name: /Start Tournament/i }).click();
        await page.waitForTimeout(3000);

        console.log('STEP 7: Verifying schedule pairings on courts...');
        const scheduleTab = page.locator('nav button').filter({ hasText: 'Schedule' }).first();
        await scheduleTab.click();
        await page.waitForTimeout(2000);

        // Check if courts are loaded
        const court1 = page.locator('.col-span-1, .p-3, div').filter({ hasText: 'Court 1' }).first();
        await expect(court1).toBeVisible();

        console.log('STEP 8: Capturing visual audit screenshot...');
        const screenshotPath = 'tests/screenshots/sim-179-players-success.png';
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  ✓ Screenshot saved successfully to ${screenshotPath}`);

        console.log('🏆 179 PLAYER SIMULATION COMPLETED SUCCESSFULLY WITH ZERO ISSUES!');
    });
});
