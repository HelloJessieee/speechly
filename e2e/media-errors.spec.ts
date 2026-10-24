import { expect, test } from '@playwright/test'

test('permission denied does not break the page', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera & microphone' }).click()
  await expect(page.getByRole('alert')).toContainText('Permission was denied')
  await expect(page.getByText('Camera: Permission denied')).toBeVisible()
  await page.getByRole('alert').getByRole('button', { name: 'Try demo mode' }).click()
  await expect(page.getByRole('button', { name: 'Record (demo)' })).toBeEnabled()
})

test('missing devices do not break the page', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('None', 'NotFoundError'))
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera & microphone' }).click()
  await expect(page.getByRole('alert')).toContainText('No camera or microphone was found')
  await expect(page.getByText('Microphone: Not found')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeDisabled()
})

test('camera missing but microphone available still records', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = (c) =>
      c?.video ? Promise.reject(new DOMException('None', 'NotFoundError')) : original(c)
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera & microphone' }).click()
  await expect(page.getByText('No camera was found. Audio recording still works.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Record', exact: true })).toBeEnabled()
})
