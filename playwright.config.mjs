import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'America/Chicago'
  },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, browserName: 'webkit' } }
  ],
  webServer: {
    // The loopback server needs no reverse DNS. HTTPServer's default getfqdn
    // can stall for a minute on Macs whose network has no PTR response.
    command: 'python3 -u -c "import http.server, socket; socket.getfqdn = lambda name=\'\': \'localhost\'; http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, ServerClass=http.server.ThreadingHTTPServer, port=4175, bind=\'127.0.0.1\')"',
    url: 'http://localhost:4175',
    reuseExistingServer: false,
    stderr: 'ignore',
    timeout: 15_000
  }
});
