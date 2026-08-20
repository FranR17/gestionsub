import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const openLocalSession = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Probar sin login' }).click()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.route('https://itunes.apple.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' })
  })
})

test('opens a local session and changes custom settings selects', async ({ page }) => {
  await openLocalSession(page)

  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible()
  await expect(page.locator('.settings select')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tema' }).click()
  await page.getByRole('option', { name: 'Oscuro' }).click()
  await expect(page.locator('main.app-shell')).toHaveClass(/dark/)

  await page.getByRole('button', { name: 'Moneda' }).click()
  await page.getByRole('option', { name: 'USD ($)' }).click()
  await expect(page.getByRole('button', { name: 'Moneda' })).toContainText('USD ($)')

  await page.getByRole('button', { name: 'Recordatorios' }).click()
  await page.getByRole('option', { name: 'Desactivados' }).click()
  await expect(page.getByRole('button', { name: 'Recordatorios' })).toContainText('Desactivados')
})

test('creates, edits and deletes a local subscription', async ({ page }) => {
  await openLocalSession(page)

  await page.getByRole('button', { name: 'Lista' }).click()
  await page.getByRole('button', { name: 'Añadir suscripción' }).click()
  await page.getByRole('button', { name: /Gasto personalizado/ }).click()

  await page.getByLabel('Nombre').fill('Prueba E2E')
  await page.getByLabel('Importe').fill('17.45')
  await page.getByLabel('Frecuencia').selectOption('trimestral')
  await page.getByLabel('Próximo cobro').fill('2026-09-15')
  await page.getByLabel('Categoría').fill('Pruebas')
  await page.getByRole('button', { name: 'Guardar' }).click()

  let subscriptionItem = page.locator('.subs-list > li').filter({ hasText: 'Prueba E2E' })
  await expect(subscriptionItem).toBeVisible()
  await subscriptionItem.getByRole('button', { name: 'Editar' }).click()

  await expect(page.getByRole('heading', { name: 'Editar' })).toBeVisible()
  await page.getByLabel('Nombre').fill('Prueba E2E editada')
  await page.getByLabel('Importe').fill('19.99')
  await page.getByRole('button', { name: 'Guardar' }).click()

  subscriptionItem = page.locator('.subs-list > li').filter({ hasText: 'Prueba E2E editada' })
  await expect(subscriptionItem).toContainText('19,99')

  await subscriptionItem.getByRole('button', { name: 'Eliminar' }).click()
  await page.getByRole('dialog', { name: 'Eliminar suscripción' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.locator('.subs-list > li').filter({ hasText: 'Prueba E2E editada' })).toHaveCount(0)
})
