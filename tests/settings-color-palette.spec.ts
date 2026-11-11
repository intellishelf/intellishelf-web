import { expect, test, type Page } from '@playwright/test';

const rose = '350 89% 60%';
const palettes = [
  { name: 'Cyan (Default)', value: '186 100% 53%' },
  { name: 'Purple', value: '270 80% 60%' },
  { name: 'Emerald', value: '160 84% 39%' },
  { name: 'Amber', value: '38 92% 50%' },
];

// The source defines a swatch inside each radio's associated label.
const swatch = (page: Page, name: string) => page.locator('label').filter({ hasText: name }).locator('div');

// Layout renders the decorative BookOpen SVG without a role, name, label, ID or test ID.
// Its source-defined Lucide class identifies the shared primary-color logo.
const logo = (page: Page) => page.locator('aside svg.lucide-book-open');

async function expectTokens(page: Page, value: string) {
  for (const token of ['--primary', '--accent', '--ring', '--sidebar-primary', '--sidebar-ring']) {
    await expect.poll(() => page.evaluate((key) => document.documentElement.style.getPropertyValue(key), token)).toBe(value);
  }
}

test.describe('Settings color palette', () => {
  const unexpected: string[] = [];

  test.beforeEach(async ({ page }) => {
    unexpected.length = 0;
    await page.route(/\/api(?:\/|\?|$)/, async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'GET' && path === '/api/auth/me') {
        await route.fulfill({ json: { id: 'synthetic-settings-user', email: 'settings@example.test' } });
      } else if (request.method() === 'GET' && path === '/api/books') {
        await route.fulfill({ json: { items: [], totalCount: 0, page: 1, pageSize: 20 } });
      } else {
        unexpected.push(`${request.method()} ${path}`);
        await route.abort();
      }
    });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Color Palette' })).toBeVisible();
  });

  test.afterEach(async () => {
    expect(unexpected).toEqual([]);
  });

  test('TC-01 [AC1, AC7] shows Rose and defaults to Cyan', async ({ page }) => {
    await expect(page.getByRole('radio')).toHaveCount(5);
    for (const palette of palettes) await expect(page.getByRole('radio', { name: palette.name })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Rose' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Cyan (Default)' })).toBeChecked();
    await expect(swatch(page, 'Rose')).toHaveCSS('background-color', 'rgb(244, 62, 92)');
  });

  test('TC-02 [AC2, AC3, AC4] applies Rose immediately and confirms it', async ({ page }) => {
    await page.getByText('Rose', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Rose' })).toBeChecked();
    await expect(swatch(page, 'Rose')).toHaveCSS('background-color', 'rgb(244, 62, 92)');
    await expect(logo(page)).toHaveCSS('color', 'rgb(244, 62, 92)');
    await expectTokens(page, rose);
    await expect(page.getByText('Color palette updated')).toBeVisible();
    await expect(page.getByText('Switched to Rose')).toBeVisible();
  });

  test('TC-03 [AC5] restores Rose after navigation and reload', async ({ page }) => {
    await test.step('Select Rose and navigate away', async () => {
      await page.getByText('Rose', { exact: true }).click();
      await page.getByRole('link', { name: 'Library' }).click();
      await page.getByRole('link', { name: 'Settings' }).click();
    });
    await test.step('Check the restored choice after remount and reload', async () => {
      await expect(page.getByRole('radio', { name: 'Rose' })).toBeChecked();
      await expect(logo(page)).toHaveCSS('color', 'rgb(244, 62, 92)');
      await page.reload();
      await expect(page.getByRole('radio', { name: 'Rose' })).toBeChecked();
      await expect(logo(page)).toHaveCSS('color', 'rgb(244, 62, 92)');
    });
  });

  test('TC-04 [AC6] retains the existing palette choices', async ({ page }) => {
    for (const palette of palettes) {
      await test.step(`Switch from Rose to ${palette.name}`, async () => {
        await page.getByText('Rose', { exact: true }).click();
        await page.getByText(palette.name, { exact: true }).click();
        await expect(page.getByRole('radio', { name: palette.name })).toBeChecked();
        await expectTokens(page, palette.value);
        await expect(logo(page)).toHaveCSS('color', await swatch(page, palette.name).evaluate((element) => getComputedStyle(element).backgroundColor));
      });
    }
  });

  test('TC-05 [AC8] selects Rose with the keyboard', async ({ page }) => {
    const amber = page.getByRole('radio', { name: 'Amber' });
    await amber.click();
    await amber.focus();
    await page.keyboard.press('ArrowDown');
    const roseRadio = page.getByRole('radio', { name: 'Rose' });
    await expect(roseRadio).toBeFocused();
    await page.keyboard.press('Space');
    await expect(roseRadio).toBeChecked();
    await expect(roseRadio).not.toHaveCSS('box-shadow', 'none');
  });
});
