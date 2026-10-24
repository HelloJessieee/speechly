import { expect, test } from '@playwright/test'

const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

for (const size of SIZES) {
  test(`layout has no horizontal overflow at ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto('/')
    for (const lesson of ['moon', 'See me.']) {
      await page.getByRole('navigation', { name: 'Lessons' }).getByRole('button', { name: new RegExp(`^${lesson.replace('.', '\\.')}`) }).click()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    }
    await page.screenshot({ path: `test-results/screens/${size.name}.png`, fullPage: true })
  })
}

test('reduced motion defaults to step-by-step view', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByLabel('Step-by-step view (no motion)')).toBeChecked()
  await expect(page.getByText('Step 1 of 6')).toBeVisible()
  await context.close()
})

test('keyboard navigation reaches lessons and controls', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to practice' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /^me/ })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^moon/ })).toHaveAttribute('aria-current', 'true')
})
