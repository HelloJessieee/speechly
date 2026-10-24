import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /face-tracking/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
      },
    },
    // Real face tracking needs a video of a face as the fake camera. Set
    // FACE_VIDEO to a .y4m file to run these tests; they are skipped otherwise.
    {
      name: 'face-tracking',
      testMatch: /face-tracking/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            ...(process.env.FACE_VIDEO ? [`--use-file-for-fake-video-capture=${process.env.FACE_VIDEO}`] : []),
          ],
        },
      },
    },
  ],
})
