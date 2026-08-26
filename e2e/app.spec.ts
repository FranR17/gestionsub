import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type PageWithBrowserErrors = Page & { __browserErrors?: string[] }

const openLocalSession = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Probar sin login' }).click()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
  await expect(page.locator('.nav-active-indicator')).toHaveCount(1)
}

test.beforeEach(async ({ page }) => {
  const browserErrors: string[] = []
  ;(page as PageWithBrowserErrors).__browserErrors = browserErrors
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  await page.route('https://example.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV3ZJwAAAABJRU5ErkJggg==',
        'base64',
      ),
    })
  })

  await page.route('https://itunes.apple.com/**', async (route) => {
    const term = new URL(route.request().url()).searchParams.get('term')
    const results = term === 'PhaseFive'
      ? [{ trackId: 505, trackName: 'Phase Five App', artworkUrl100: 'https://example.com/100x100bb.png', primaryGenreName: 'Productividad' }]
      : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) })
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = (page as PageWithBrowserErrors).__browserErrors ?? []

  expect(browserErrors).toEqual([])
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
  await page.locator('.subs').getByRole('button', { name: 'Añadir suscripción' }).click()
  await page.getByRole('button', { name: /Gasto personalizado/ }).click()

  await expect(page.getByLabel('Nombre')).toBeFocused()
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

  const deleteButton = subscriptionItem.getByRole('button', { name: 'Eliminar' })
  await deleteButton.click()
  const deleteDialog = page.getByRole('dialog', { name: 'Eliminar suscripción' })
  await expect(deleteDialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(deleteDialog).toHaveCount(0)
  await expect(deleteButton).toBeFocused()

  await deleteButton.click()
  await page.getByRole('dialog', { name: 'Eliminar suscripción' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByRole('dialog', { name: 'Eliminar suscripción' })).toHaveCount(0)
  await expect(page.locator('.subs-list > li').filter({ hasText: 'Prueba E2E editada' })).toHaveCount(0)
})

test('transitions from the gateway and selects an app result', async ({ page }) => {
  await openLocalSession(page)

  await page.getByRole('button', { name: 'Añadir suscripción' }).first().click()
  await page.getByRole('button', { name: /Nueva suscripción/ }).click()
  const appSearch = page.getByRole('searchbox', { name: 'Buscar en App Store' })
  await expect(appSearch).toBeFocused()
  await appSearch.fill('PhaseFive')

  await page.getByRole('button', { name: /Phase Five App/ }).click()
  await expect(page.getByLabel('Nombre')).toHaveValue('Phase Five App')
  await expect(page.getByLabel('Nombre')).toBeFocused()
})

test('filters subscriptions and keeps calendar interactions stable', async ({ page }) => {
  await openLocalSession(page)

  await page.getByRole('button', { name: 'Lista' }).click()
  await page.getByRole('button', { name: 'Mostrar filtros' }).click()
  await expect(page.getByRole('button', { name: 'Ocultar filtros' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#subscription-filters')).toBeVisible()
  await page.getByRole('button', { name: 'Ocultar filtros' }).click()
  await expect(page.locator('#subscription-filters')).toHaveCount(0)

  const subscriptions = page.locator('.subs-list > li')
  const search = page.getByRole('searchbox', { name: 'Buscar por nombre, categoría…' })
  await expect(subscriptions).toHaveCount(3)
  await search.fill('Netflix')
  await expect(subscriptions).toHaveCount(1)
  await search.fill('Sin resultados')
  await expect(page.getByText('No hay resultados', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(subscriptions).toHaveCount(3)

  await page.getByRole('button', { name: 'Calendario' }).click()
  const calendarGrid = page.locator('.tl-grid')
  await expect(calendarGrid.locator('.tl-day')).toHaveCount(42)
  const initialHeight = await calendarGrid.evaluate((element) => element.getBoundingClientRect().height)
  const initialMonth = await page.locator('.tl-cal-nav strong').textContent()

  await page.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(page.locator('.tl-cal-nav strong')).not.toHaveText(initialMonth ?? '')
  await expect(page.locator('.tl-grid')).toHaveCount(1)
  await expect(calendarGrid.locator('.tl-day')).toHaveCount(42)
  const nextHeight = await calendarGrid.evaluate((element) => element.getBoundingClientRect().height)
  expect(nextHeight).toBe(initialHeight)

  const paidButton = page.getByRole('button', { name: 'Marcar como pagado' }).first()
  await expect(paidButton).toBeVisible()
  await paidButton.click()
  await expect(page.getByRole('button', { name: 'Marcar como no pagado' }).first()).toBeVisible()
})

test('keeps desktop navigation and content layout usable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop-only layout coverage')

  await openLocalSession(page)

  const nav = page.getByRole('navigation', { name: 'Navegación principal' })
  const screen = page.locator('.screen')
  await expect(nav).toBeVisible()
  await expect(screen).toBeVisible()

  const navBox = await nav.boundingBox()
  const screenBox = await screen.boundingBox()
  expect(navBox).not.toBeNull()
  expect(screenBox).not.toBeNull()
  expect(navBox!.width).toBeGreaterThan(180)
  expect(screenBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width - 1)
  expect(screenBox!.width).toBeGreaterThan(700)

  await expect(nav.getByRole('button', { name: 'Añadir suscripción' })).toBeVisible()

  for (const viewName of ['Lista', 'Calendario', 'Ajustes', 'Inicio']) {
    await nav.getByRole('button', { name: viewName }).click()
    await expect(screen).toBeVisible()
  }
})

test('keeps the latest view stable during rapid reduced-motion navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openLocalSession(page)

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Navegación principal"] button'))
    for (const label of ['Lista', 'Calendario', 'Grupos']) {
      buttons.find((button) => button.textContent?.includes(label))?.click()
    }
  })

  await expect(page.getByRole('region', { name: 'Grupos' })).toBeVisible()
  await expect(page.locator('.view-transition-layer')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Grupos' })).toHaveAttribute('aria-current', 'page')
})
