import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { newTestAccount } from './support/credentials';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080/api';

test.describe('Book Language field', () => {
  const account = newTestAccount();
  const run = Date.now();
  let token = '';

  async function api(playwright: { request: { newContext: (o: { baseURL: string }) => Promise<APIRequestContext> } }) {
    return playwright.request.newContext({ baseURL: API_BASE_URL.replace(/\/?$/, '/') });
  }

  async function createBook(ctx: APIRequestContext, title: string, language?: string): Promise<string> {
    const multipart: Record<string, string | number> = { Title: title, Status: 0 };
    if (language) multipart.Language = language;
    const res = await ctx.post('books', { headers: { Authorization: `Bearer ${token}` }, multipart });
    expect(res.ok(), `create ${title}`).toBeTruthy();
    return (await res.json()).id as string;
  }

  test.beforeAll(async ({ playwright }) => {
    const ctx = await api(playwright);
    const reg = await ctx.post('auth/register', { data: account });
    expect(reg.ok()).toBeTruthy();
    token = (await reg.json()).accessToken;
    await ctx.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    const ctx = await api(playwright);
    const headers = { Authorization: `Bearer ${token}` };
    // The account is synthetic and per-run, so remove every book it owns.
    const list = await ctx.get('books?pageSize=100', { headers });
    if (list.ok()) {
      for (const b of (await list.json()).items ?? []) await ctx.delete(`books/${b.id}`, { headers });
    }
    await ctx.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  async function openByTitle(page: Page, title: string) {
    await page.getByTestId('book-card').filter({ hasText: title }).getByRole('heading', { level: 3 }).click();
    await expect(page).toHaveURL(/\/book\//);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }

  async function addViaForm(page: Page, title: string, language?: string) {
    await page.goto('/add');
    await page.getByLabel('Title *').fill(title);
    if (language) await page.getByLabel('Language').fill(language);
    await page.getByRole('button', { name: 'Add Book' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('book-card').filter({ hasText: title })).toBeVisible();
  }

  test('TC-01 [G1/AC6, AC8, AC9] a language entered on add is shown on the details page', async ({ page }) => {
    const title = `Lang uk ${run}`;
    await test.step('Add a book with Language "uk"', async () => {
      await addViaForm(page, title, 'uk');
    });
    await test.step('Open its details', async () => {
      await openByTitle(page, title);
    });
    await test.step('Language is shown', async () => {
      await expect(page.getByText('Language', { exact: true })).toBeVisible();
      await expect(page.getByText('uk', { exact: true })).toBeVisible();
    });
  });

  test('TC-02 [G1/AC7, AC10] a blank language saves and shows no language entry', async ({ page }) => {
    const title = `Lang blank ${run}`;
    await test.step('Add a book with Language blank', async () => {
      await addViaForm(page, title);
    });
    await test.step('Open its details; no language entry', async () => {
      await openByTitle(page, title);
      await expect(page.getByText('Language', { exact: true })).toHaveCount(0);
    });
  });

  test('TC-03 [G1/AC3, AC4, AC8] language is pre-filled, changed, then cleared in the edit form', async ({ page, playwright }) => {
    const title = `Lang edit ${run}`;
    const ctx = await api(playwright);
    await createBook(ctx, title, 'uk');
    await ctx.dispose();
    await page.reload();
    const card = page.getByTestId('book-card').filter({ hasText: title });

    async function openEdit() {
      await card.getByTestId('book-card-poster').hover();
      await card.getByTestId('book-card-poster').locator('button').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
    async function save() {
      await page.getByRole('button', { name: 'Update Book' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }

    await test.step('Field is pre-filled with "uk"', async () => {
      await openEdit();
      await expect(page.getByRole('dialog').getByLabel('Language')).toHaveValue('uk');
    });
    await test.step('Change to "en" and save', async () => {
      await page.getByRole('dialog').getByLabel('Language').fill('en');
      await save();
      await openByTitle(page, title);
      await expect(page.getByText('en', { exact: true })).toBeVisible();
      await page.goBack();
    });
    await test.step('Clear and save; no language entry', async () => {
      await openEdit();
      await page.getByRole('dialog').getByLabel('Language').fill('');
      await save();
      await openByTitle(page, title);
      await expect(page.getByText('Language', { exact: true })).toHaveCount(0);
    });
  });

  test('TC-04 [G1/AC5] a book without language works; details inline edit keeps a stored language', async ({ page }) => {
    const plain = `Lang legacy ${run}`;
    const withLang = `Lang keep ${run}`;
    await test.step('Create books without and with a language', async () => {
      await addViaForm(page, plain);
      await addViaForm(page, withLang, 'uk');
    });
    await test.step('Plain book opens and its title can be edited', async () => {
      await openByTitle(page, plain);
      await page.getByTestId('book-edit').click();
      await page.getByLabel('Title').fill(`${plain} v2`);
      await page.getByTestId('book-save').click();
      await expect(page.getByRole('heading', { level: 1, name: `${plain} v2` })).toBeVisible();
      await expect(page.getByText('Language', { exact: true })).toHaveCount(0);
    });
    await test.step('Inline edit of the title keeps the stored language', async () => {
      await page.goto('/');
      await openByTitle(page, withLang);
      await page.getByTestId('book-edit').click();
      await expect(page.getByLabel('Language')).toHaveValue('uk');
      await page.getByLabel('Title').fill(`${withLang} v2`);
      await page.getByTestId('book-save').click();
      await expect(page.getByRole('heading', { level: 1, name: `${withLang} v2` })).toBeVisible();
      await page.reload();
      await expect(page.getByText('uk', { exact: true })).toBeVisible();
    });
  });
});
