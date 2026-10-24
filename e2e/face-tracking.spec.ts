import { expect, test, type Page } from '@playwright/test'
import type { FeedbackApiRequest } from '../src/feedback/api'

test.skip(!process.env.FACE_VIDEO, 'Set FACE_VIDEO to a .y4m video of a face to run face-tracking tests.')
test.setTimeout(60_000)

async function recordAttempt(page: Page) {
  await page.context().grantPermissions(['camera', 'microphone'])
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Lessons' }).getByRole('button', { name: /^moon/ }).click()
  await page.getByRole('button', { name: 'Start camera & microphone' }).click()
  await expect(page.getByText('Tracking your lips')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByRole('heading', { name: 'What the camera measured' })).toBeVisible()
}

test('tracks the face, measures the attempt and shows Claude feedback', async ({ page }) => {
  let sent: FeedbackApiRequest | null = null
  await page.route('**/api/feedback/status', (route) => route.fulfill({ json: { available: true, model: 'claude-opus-5-5' } }))
  await page.route('**/api/feedback', async (route) => {
    sent = route.request().postDataJSON() as FeedbackApiRequest
    await route.fulfill({
      json: {
        ok: true,
        feedback: {
          source: 'claude',
          lessonId: 'moon',
          status: 'suggestion',
          practiceFocus: 'Rounded lips',
          observation: 'Your lips appear spread in a wide smile rather than rounded.',
          evidence: ['Snapshot 2: wide, spread lips', 'Width stayed at 1.00 of rest'],
          tip: 'Try letting the corners of your mouth move gently inward for “oo.”',
          actionId: 'practice_rounded_shape',
          comparedToPrevious: null,
          isIllustrative: false,
          model: 'claude-opus-5-5',
          attemptId: 'x',
        },
      },
    })
  })

  await recordAttempt(page)
  // The local checks for “moon” run, and mouth-only snapshots are shown.
  await expect(page.getByText('Lip closure', { exact: true })).toBeVisible()
  await expect(page.getByText('Rounded lips', { exact: true })).toBeVisible()
  expect(await page.getByRole('img', { name: /^Your mouth:/ }).count()).toBeGreaterThan(0)

  await expect(page.getByText(/Sends your lip measurements/)).toBeVisible()
  await page.getByRole('button', { name: 'Get feedback from Claude' }).click()
  await expect(page.getByText('Your lips appear spread in a wide smile rather than rounded.')).toBeVisible()
  await expect(page.getByText('Observed', { exact: true })).toBeVisible()
  await expect(page.getByText('Suggestion', { exact: true })).toBeVisible()
  await expect(page.getByText('Something to try')).toBeVisible()
  await expect(page.getByText(/AI feedback from Claude/)).toBeVisible()

  // The request carries measurements and small JPEG mouth crops, never audio.
  expect(sent).not.toBeNull()
  const body = sent as unknown as FeedbackApiRequest
  expect(body.lessonId).toBe('moon')
  expect(body.analysis.usable).toBe(true)
  expect(body.analysis.faceVisible).toBeGreaterThan(0.8)
  expect(body.analysis.checks.map((c) => c.id)).toEqual(['closure', 'rounding'])
  expect(body.analysis.snapshots.length).toBeGreaterThan(0)
  for (const snapshot of body.analysis.snapshots) expect(snapshot.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
  expect(JSON.stringify(body)).not.toContain('audio/')

  await page.getByRole('button', { name: 'Watch the guidance' }).click()
  await expect(page.getByRole('button', { name: 'Correction guidance' })).toHaveAttribute('aria-pressed', 'true')
})

test('shows a clear message when Claude feedback fails, with demo fallback', async ({ page }) => {
  await page.route('**/api/feedback/status', (route) => route.fulfill({ json: { available: true, model: 'claude-opus-5-5' } }))
  await page.route('**/api/feedback', (route) =>
    route.fulfill({ status: 402, json: { ok: false, error: 'The Claude API account has no credits left.' } }),
  )
  await recordAttempt(page)
  await page.getByRole('button', { name: 'Get feedback from Claude' }).click()
  await expect(page.getByRole('alert')).toContainText('no credits left')
  await page.getByRole('alert').getByRole('button', { name: 'Show demo feedback' }).click()
  await expect(page.getByText('Demo feedback. Your recording has not been automatically assessed.')).toBeVisible()
  await expect(page.getByText(/Example 1 of 2/)).toBeVisible()
})
