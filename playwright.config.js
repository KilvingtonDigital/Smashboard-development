// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const AUTH_STATE = path.join(__dirname, 'tests', '.auth-state.json');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: false,          // E2E tests run sequentially
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,                    // Sequential — no parallel interference
    reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
    timeout: 180 * 1000,            // 3 min per test
    use: {
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        headless: true,
    },
    projects: [
        // 1. Auth setup — runs once, saves storage state
        {
            name: 'setup',
            testMatch: '**/auth.setup.js',
            use: { ...devices['Desktop Chrome'], headless: true },
        },
        // 2. Regular chromium tests
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
            dependencies: ['setup'],
        },
        // 3. E2E project — visible browser, with auth
        {
            name: 'e2e',
            testMatch: '**/e2e-*.spec.js',
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: AUTH_STATE,
                headless: false,   // Keep visible so user can watch
                // slowMo removed — was burning through timeout
            },
        },
    ],
    webServer: process.env.PLAYWRIGHT_TEST_BASE_URL ? undefined : {
        command: 'npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
