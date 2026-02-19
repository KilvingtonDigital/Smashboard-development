// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Court Management', () => {
    test.beforeEach(async ({ page }) => {
        // Reset app state if possible, or just reload
        await page.goto('/');

        // Check if we need to clear data
        // Ideally we'd have a data-testid or button to reset
        // For now, let's assume fresh start or handle existing state

        // We can use local storage manipulation to clear state
        await page.evaluate(() => {
            localStorage.clear();
            window.location.reload();
        });
        await expect(page.getByText('Tournament Setup')).toBeVisible();
    });

    test('Cleaning a match keeps players busy', async ({ page }) => {
        // Capture browser console logs to see application state
        page.on('console', msg => console.log(`BROWSER_LOG: ${msg.text()}`));

        console.log('Starting test...');
        // 1. Add Players
        console.log('Clicking Roster...');
        await page.getByRole('button', { name: 'Roster' }).click();

        console.log('Opening Bulk Add...');
        // Open Bulk Add details if closed (it's a details/summary)
        const bulkDetails = page.locator('summary').filter({ hasText: 'Bulk add' });
        await bulkDetails.click();

        console.log('Filling Bulk Text...');
        await page.getByPlaceholder(/Jane Doe/i).fill('Player 1, 3.5, M\nPlayer 2, 3.5, M\nPlayer 3, 3.5, M\nPlayer 4, 3.5, M\nPlayer 5, 3.5, M\nPlayer 6, 3.5, M');
        console.log('Clicking Parse & Add...');
        await page.getByRole('button', { name: 'Parse & add' }).click();
        console.log('Verifying Player 1 visible...');
        await expect(page.getByText('Player 1')).toBeVisible();

        // 2. Start Tournament
        console.log('Clicking Setup...');
        await page.getByRole('button', { name: 'Setup' }).click();
        console.log('Clicking Start Tournament...');
        // Note: The button text might be "Start Tournament (Generate Round 1)"
        // Using regex to match part of it
        await page.getByRole('button', { name: /Start Tournament/i }).click();

        // Switch to Schedule tab to see matches
        console.log('Clicking Schedule...');
        await page.getByRole('button', { name: 'Schedule' }).click();

        // 3. Verify match on Court 1
        console.log('Locating Court 1...');
        const court1 = page.locator('.col-span-1, .p-3').filter({ hasText: 'Court 1' }).first();

        // Assign match if needed
        console.log('Checking for Assign Match button...');
        if (await court1.getByText('Assign Match').isVisible()) {
            console.log('Assigning match manually...');
            await court1.getByText('Assign Match').click();
        }

        // Wait for Playing status
        console.log('Waiting for PLAYING status...');
        await expect(court1.getByText(/PLAYING/i)).toBeVisible();

        // 4. Set Cleaning
        console.log('Clicking Set Cleaning...');
        await court1.getByRole('button', { name: 'Set Cleaning' }).click();

        // 5. Verify Cleaning Status
        console.log('Verifying CLEANING status...');
        await expect(court1.getByText(/CLEANING/i)).toBeVisible();
        await expect(court1.getByText(/READY/i)).not.toBeVisible();

        // 6. Attempt to assign match on Court 2 with remaining players
        console.log('Locating Court 2...');
        const court2 = page.locator('.col-span-1, .p-3').filter({ hasText: 'Court 2' }).first();

        console.log('Checking availability of Assign Match on Court 2...');
        if (await court2.getByText('Assign Match').isVisible()) {
            console.log('Attempting invalid assignment on Court 2...');
            await court2.getByText('Assign Match').click();

            // Assert Court 2 does NOT go to PLAYING because not enough players
            console.log('Verifying Court 2 is NOT playing...');
            await expect(court2.getByText(/PLAYING/i)).not.toBeVisible();
        }
        console.log('Test completed successfully');
    });
});
