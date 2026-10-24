import { expect, test, type Page } from '@playwright/test'

const LESSONS = ['me', 'moon', 'fish', 'pea', 'bee', 'See me.']

const lessonButton = (page: Page, text: string) =>
  page.getByRole('navigation', { name: 'Lessons' }).getByRole('button', { name: new RegExp(`^${text.replace('.', '\\.')}`) })

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
  ;(page as unknown as { errors: string[] }).errors = errors
  await page.goto('/')
})

test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([])
})

test('all six lessons can be selected and update content', async ({ page }) => {
  for (const text of LESSONS) {
    await lessonButton(page, text).click()
    await expect(lessonButton(page, text)).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('heading', { name: `How to say “${text}”` })).toBeVisible()
    await expect(page.getByRole('img', { name: new RegExp(`Mouth illustration for “${text.replace('.', '\\.')}”`) })).toBeVisible()
  }
  await lessonButton(page, 'pea').click()
  await expect(page.getByText('Lip shape alone cannot show which one you said.')).toBeVisible()
})

test('reference animation play, pause, replay and speed', async ({ page }) => {
  const slider = page.getByRole('slider', { name: 'Animation progress' })
  await expect(slider).toHaveValue('0')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Pause' }).click()
  const paused = Number(await slider.inputValue())
  expect(paused).toBeGreaterThan(300)
  await page.waitForTimeout(300)
  expect(Number(await slider.inputValue())).toBe(paused)
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()

  await page.getByRole('button', { name: 'Slow' }).click()
  await expect(page.getByRole('button', { name: 'Slow' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Replay' }).click()
  await page.waitForTimeout(500)
  const slow = Number(await slider.inputValue())
  // At half speed, 500 ms of wall time covers roughly 250 ms of timeline.
  expect(slow).toBeGreaterThan(100)
  expect(slow).toBeLessThan(450)

  // Step-by-step mode shows discrete states.
  await page.getByLabel('Step-by-step view (no motion)').check()
  await expect(page.getByText('Step 1 of 6')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Step 2 of 6')).toBeVisible()
})

test('audio preview falls back gracefully', async ({ page }) => {
  const hear = page.getByRole('button', { name: /Hear “me”/ })
  if (await hear.isDisabled()) await expect(page.getByText('Audio preview is unavailable on this device.')).toBeVisible()
})

test('demo mode: full flow without permissions, correction and retry', async ({ page }) => {
  await lessonButton(page, 'moon').click()
  await page.getByRole('button', { name: 'Try demo mode' }).click()
  await expect(page.getByText('Demo mode — camera and microphone are off')).toBeVisible()
  await page.getByRole('button', { name: 'Record (demo)' }).click()
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByText('Demo attempt — no audio was captured')).toBeVisible()

  await expect(page.getByText('Demo feedback. Your recording has not been automatically assessed.')).toBeVisible()
  await page.getByRole('button', { name: 'Show demo feedback' }).click()
  await expect(page.getByText('Example 1 of 2: a corrective suggestion')).toBeVisible()
  await expect(page.getByText('Rounded vowel', { exact: true })).toBeVisible()
  await expect(page.getByText('Try gently rounding your lips, then repeat “moon.”')).toBeVisible()

  await page.getByRole('button', { name: 'Watch the guidance' }).click()
  await expect(page.getByRole('button', { name: 'Correction guidance' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Try gently rounding your lips while practicing /u/.')).toBeVisible()
  await expect(page.getByText('not an observation about you')).toBeVisible()

  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('to see example feedback')).toBeVisible()
  await expect(page.getByText('Demo attempt — no audio was captured')).toHaveCount(0)

  await page.getByRole('button', { name: 'Record (demo)' }).click()
  // The simulated attempt stops by itself after three seconds.
  await expect(page.getByText('Demo attempt — no audio was captured')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Show demo feedback' }).click()
  await expect(page.getByText('Example 2 of 2: acknowledging a change')).toBeVisible()
  await expect(lessonButton(page, 'moon')).toContainText('2 attempts this session')
})

test('correction guidance changes per lesson', async ({ page }) => {
  const expectations: Record<string, string> = {
    me: 'Let your lips meet softly for /m/, then open into “ee.”',
    moon: 'Try gently rounding your lips while practicing /u/.',
    fish: 'Try resting your upper teeth lightly on your lower lip for /f/.',
    'See me.': 'notice the lips close once',
  }
  for (const [text, instruction] of Object.entries(expectations)) {
    await lessonButton(page, text).click()
    await page.getByRole('button', { name: 'Correction guidance' }).click()
    await expect(page.getByText(instruction)).toBeVisible()
  }
})

test('live camera and microphone: preview, record, replay, discard', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'microphone'])
  await page.getByRole('button', { name: 'Start camera & microphone' }).click()
  await expect(page.getByLabel('Your camera preview, mirrored')).toBeVisible()
  await expect(page.getByText('Camera: On')).toBeVisible()
  await expect(page.getByText('Microphone: On')).toBeVisible()
  await expect(page.getByRole('meter', { name: 'Microphone signal level' })).toBeVisible()
  await expect
    .poll(() => page.getByLabel('Your camera preview, mirrored').evaluate((v: HTMLVideoElement) => v.videoWidth > 0))
    .toBe(true)
  // The preview is mirrored.
  await expect(page.getByLabel('Your camera preview, mirrored')).toHaveCSS('scale', '-1 1')

  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  const audio = page.getByLabel('Replay your recording')
  await expect(audio).toBeVisible()
  expect(await audio.getAttribute('src')).toMatch(/^blob:/)
  await expect(page.getByText(/Mic signal/)).toBeVisible()

  await page.getByRole('button', { name: 'Discard recording' }).click()
  await expect(audio).toHaveCount(0)

  await page.getByRole('button', { name: /Turn off camera/ }).click()
  await expect(page.getByRole('button', { name: 'Start camera & microphone' })).toBeVisible()
})

test('recording stops automatically at the limit', async ({ page, context }) => {
  test.setTimeout(40_000)
  await context.grantPermissions(['camera', 'microphone'])
  await page.getByRole('button', { name: 'Start camera & microphone' }).click()
  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await expect(page.getByLabel('Replay your recording')).toBeVisible({ timeout: 13_000 })
  await expect(page.getByText(/Length 0:10\.0/)).toBeVisible()
})
