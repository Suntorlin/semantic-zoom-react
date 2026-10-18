import { defineConfig, devices } from '@playwright/test'

const phone = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['github'], ['json', { outputFile: 'artifacts/e2e-results.json' }]]
    : [['list'], ['json', { outputFile: 'artifacts/e2e-results.json' }]],
  use: { baseURL: 'http://localhost:5189/', trace: 'off' },
  webServer: {
    command: 'bunx vite build --config demo/vite.config.ts && bunx vite preview --config demo/vite.config.ts',
    url: 'http://localhost:5189/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'phone-chromium', testMatch: /phone\.spec\.ts/, use: { ...devices['Pixel 7'], ...phone, browserName: 'chromium' } },
    { name: 'desktop-chromium', testMatch: /desktop\.spec\.ts/, use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'phone-webkit', testMatch: /webkit\.spec\.ts/, use: { ...devices['iPhone 15'], ...phone, browserName: 'webkit' } },
  ],
})
