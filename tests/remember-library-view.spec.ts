import { test, expect, type Page } from '@playwright/test';
import { newTestAccount } from './support/credentials';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080/api';
const key = 'library-view-mode';
const title = `Library view test ${Date.now()}`;

// Check both the selected control and the rendered layout around a real book.
async function expectView(page: Page, mode: 'grid' | 'list') {
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', String(mode === 'grid'));
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', String(mode === 'list'));
  await expect(page.getByTestId('library-books')).toHaveClass(mode === 'grid' ? /\bgrid\b/ : /\bflex-col\b/);
}

test.describe('Remember Library view', () => {
  const account = newTestAccount();
  let token = '';
  let bookId = '';

  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_BASE_URL.replace(/\/?$/, '/') });
    try {
      const registration = await api.post('auth/register', { data: account });
      expect(registration.ok()).toBeTruthy();
      token = (await registration.json()).accessToken;
      const book = await api.post('books', { headers: { Authorization: `Bearer ${token}` }, multipart: { Title: title, Status: 0 } });
      expect(book.ok()).toBeTruthy();
      bookId = (await book.json()).id;
    } finally {
      await api.dispose();
    }
  });

  test.afterAll(async ({ playwright }) => {
    if (!bookId) return;
    const api = await playwright.request.newContext({ baseURL: API_BASE_URL.replace(/\/?$/, '/') });
    try {
      const response = await api.delete(`books/${bookId}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(response.ok()).toBeTruthy();
    } finally {
      await api.dispose();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectView(page, 'grid');
  });

  test('TC-01 [G1/AC1, AC2] defaults to grid and switches immediately', async ({ page }) => {
    await test.step('Select list', async () => {
      await page.getByRole('button', { name: 'List view' }).click();
      await expectView(page, 'list');
    });
    await test.step('Select grid', async () => {
      await page.getByRole('button', { name: 'Grid view' }).click();
      await expectView(page, 'grid');
    });
  });

  test('TC-02 [G1/AC3] restores the latest selection after reload', async ({ page }) => {
    for (const mode of ['list', 'grid'] as const) {
      await test.step(`Select ${mode} and reload`, async () => {
        await page.getByRole('button', { name: `${mode === 'grid' ? 'Grid' : 'List'} view` }).click();
        await expectView(page, mode);
        await page.reload();
        await expectView(page, mode);
      });
    }
  });

  test('TC-03 [G1/AC4] restores the latest selection after navigation', async ({ page }) => {
    for (const mode of ['list', 'grid'] as const) {
      await test.step(`Select ${mode}, visit Settings, and return`, async () => {
        await page.getByRole('button', { name: `${mode === 'grid' ? 'Grid' : 'List'} view` }).click();
        await expectView(page, mode);
        await page.getByRole('link', { name: 'Settings' }).click();
        await expect(page).toHaveURL(/\/settings/);
        await page.getByRole('link', { name: 'Library' }).click();
        await expectView(page, mode);
      });
    }
  });

  test('TC-04 [G1/AC5] defaults to grid for invalid or unreadable preference', async ({ page }) => {
    await test.step('Reload with an invalid value', async () => {
      await page.evaluate(({ key }) => localStorage.setItem(key, 'invalid'), { key });
      await page.reload();
      await expectView(page, 'grid');
    });
    await test.step('Reload when reading the preference throws', async () => {
      await page.addInitScript(({ key }) => {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function (name) {
          if (name === key) throw new Error('Storage unavailable');
          return original.call(this, name);
        };
      }, { key });
      await page.reload();
      await expectView(page, 'grid');
      await page.getByRole('button', { name: 'List view' }).click();
      await expectView(page, 'list');
    });
  });

  test('TC-05 [G1/AC6] switches views when saving fails', async ({ page }) => {
    await page.addInitScript(({ key }) => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new Error('Storage unavailable');
        return original.call(this, name, value);
      };
    }, { key });
    await page.reload();
    for (const mode of ['list', 'grid'] as const) {
      await test.step(`Select ${mode} with storage unavailable`, async () => {
        await page.getByRole('button', { name: `${mode === 'grid' ? 'Grid' : 'List'} view` }).click();
        await expectView(page, mode);
      });
    }
  });
});
