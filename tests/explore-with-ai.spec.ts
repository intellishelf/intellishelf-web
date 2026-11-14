import fs from 'node:fs';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// The verifier creates isolated synthetic accounts and saves their authenticated browser states.
const PRO = process.env.E2E_PRO_STATE ?? '.auth/explore-pro.json';
const NON_PRO = process.env.E2E_NON_PRO_STATE ?? '.auth/explore-non-pro.json';
const API = process.env.API_BASE_URL ?? 'http://localhost:8080/api';
const examples = ['Books about how knowledge grows', 'Stories of loneliness and isolation', 'What do I own about scientific explanations?', 'Books similar to The Beginning of Infinity'];
const disclosure = "AI search sends your books' details, including your personal notes, and what you type here to OpenAI.";
const proDisclosure = "With Pro, your books' details, including your personal notes, and your Explore prompts are sent to OpenAI to power AI search.";

async function seed(api: APIRequestContext, title: string, extra: Record<string, string> = {}) {
  const response = await api.post(`${API}/books`, { multipart: { Title: title, Status: '0', ...extra } });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).id as string;
}
async function openLibrary(page: Page, path = '/') {
  await page.goto(path);
  test.skip(/\/auth/.test(page.url()), 'Saved session expired; verifier must refresh it');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
}
async function turnOn(page: Page) { await page.getByRole('switch', { name: 'Explore with AI' }).check(); }
async function search(page: Page, value: string) { await page.getByLabel('Search books').fill(value); }
async function submit(page: Page, value: string) { await search(page, value); await page.getByLabel('Search books').press('Enter'); }

// Ticket: no tracker ticket supplied; oracle is the approved AI vector search plan.
test.describe('AI vector search: Explore with AI', () => {
  test.setTimeout(120_000);
  let api: APIRequestContext;
  let ids: string[];
  let requests: string[];
  test.beforeEach(async ({ playwright, page }, testInfo) => {
    api = null!; ids = [];
    const nonPro = /TC-10|TC-13/.test(testInfo.title);
    const state = nonPro ? NON_PRO : PRO;
    test.skip(!fs.existsSync(state), `Needs verifier-created synthetic account state: ${state}`);
    await page.context().addCookies(JSON.parse(fs.readFileSync(state, 'utf8')).cookies);
    api = await playwright.request.newContext({ storageState: state });
    const me = await api.get(`${API}/auth/me`);
    test.skip(!me.ok(), `${state} has expired; verifier must refresh it`);
    const user = await me.json();
    expect(!!user.isPro).toBe(!nonPro);
    ids = [];
    requests = [];
    page.on('request', request => { if (request.url().includes('/api/books/explore') || request.url().includes('/api/books/search')) requests.push(request.url()); });
    if (!/TC-01|TC-13/.test(testInfo.title)) {
      if (nonPro) ids.push(await seed(api, 'Dune'));
      else {
        ids.push(await seed(api, 'Dune', { Authors: 'Frank Herbert' }));
        ids.push(await seed(api, 'The Quiet Lighthouse', { Description: 'A keeper lives alone in solitude.' }));
        for (let i = 1; i <= 14; i++) ids.push(await seed(api, `Harbor Tales ${i}`));
        await expect.poll(async () => {
          const response = await api.post(`${API}/books/explore`, { data: { prompt: 'Harbor' } });
          return response.ok() ? (await response.json()).items.length : 0;
        }, { timeout: 30000 }).toBe(14);
      }
    }
    await openLibrary(page, /TC-04/.test(testInfo.title) ? '/?pageSize=12' : '/');
  });
  test.afterEach(async () => {
    if (!api) return;
    for (const id of ids ?? []) await api.delete(`${API}/books/${id}`);
    await api.dispose();
  });

  test('TC-01 [G2/AC17] empty library does not submit', async ({ page }) => {
    await turnOn(page); await submit(page, 'Dune');
    await expect(page.getByRole('heading', { name: 'No books in your library yet' })).toBeVisible();
    expect(requests.filter(url => url.includes('/explore'))).toHaveLength(0);
  });
  test('TC-02 [G1/AC6, G1/AC7, G2/AC3, G2/AC12, G2/AC16, G9/AC1] mode keeps text and does not search while typing', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: 'Explore with AI' });
    await expect(toggle).not.toBeChecked();
    await search(page, 'Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    expect(requests.some(url => url.includes('/search'))).toBe(true);
    const before = await page.getByTestId('book-card').allTextContents();
    await turnOn(page); const count = requests.length;
    await expect(page.getByLabel('Search books')).toHaveAttribute('placeholder', 'Describe ideas, themes or a book you liked');
    await expect(page.getByLabel('Search books')).toHaveValue('Dune');
    for (const example of examples) await expect(page.getByRole('button', { name: example })).toBeVisible();
    await expect(page.getByText(disclosure)).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('switch')).toHaveCount(1);
    await expect(page.getByTestId('book-card')).toHaveText(before);
    await search(page, 'Dune more'); expect(requests).toHaveLength(count);
    expect(page.url()).not.toContain('Dune');
    await expect(page.getByText(/lexical|vector|semantic|hybrid/i)).toHaveCount(0);
    await toggle.uncheck(); await expect(page.getByLabel('Search books')).toHaveValue('Dune more');
    await expect.poll(() => requests.length).toBeGreaterThan(count);
  });
  test('TC-03 [G2/AC2, G2/AC5, G2/AC6, G2/AC14, G3/AC6] chip submits once and results support both views', async ({ page }) => {
    await turnOn(page); await page.getByRole('button', { name: examples[1] }).click();
    await expect(page.getByLabel('Search books')).toHaveValue(examples[1]); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/books/explore', async route => { await gate; await route.continue(); });
    await page.getByLabel('Search books').press('Enter'); await expect(page.getByLabel('Loading results')).toBeVisible(); await expect(page.getByTestId('book-card')).toHaveCount(0); release();
    await expect(page.getByTestId('book-card').filter({ hasText: 'The Quiet Lighthouse' })).toBeVisible();
    for (const name of ['All', 'Unread', 'Reading', 'Read']) await expect(page.getByRole('tab', { name, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'List view' }).click(); await expect(page.getByTestId('book-card').filter({ hasText: 'The Quiet Lighthouse' })).toBeVisible();
    await expect(page.getByText(/% relevant|similarity score/i)).toHaveCount(0); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(1);
  });
  test('TC-04 [G2/AC19, G2/AC15, G3/AC10] paging and browser back preserve order without requests', async ({ page }) => {
    await turnOn(page); await submit(page, 'Harbor'); await expect(page.getByText('14 books found')).toBeVisible();
    await expect(page.getByTestId('book-card')).toHaveCount(12); const firstPage = await page.getByTestId('book-card').allTextContents(); await page.getByRole('link', { name: '2', exact: true }).click();
    await expect(page.getByTestId('book-card')).toHaveCount(2); const order = await page.getByTestId('book-card').allTextContents(); expect(new Set([...firstPage, ...order]).size).toBe(14);
    await page.getByLabel('Per page:').click(); await page.getByRole('option', { name: '24', exact: true }).click();
    await page.getByLabel('Per page:').click(); await page.getByRole('option', { name: '12', exact: true }).click(); await page.getByRole('link', { name: '2', exact: true }).click();
    await page.getByTestId('book-card').filter({ hasText: order[0] }).click(); await expect(page).toHaveURL(/\/book\//); await page.goBack();
    await expect(page.getByRole('switch', { name: 'Explore with AI' })).toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('Harbor');
    await expect(page.getByTestId('book-card')).toHaveText(order); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(1);
  });
  test('TC-05 [G3/AC3] exact title ranks first', async ({ page }) => {
    await turnOn(page); await submit(page, 'Dune'); await expect.poll(async () => (await page.getByTestId('book-card').allTextContents())[0]).toContain('Dune');
  });
  test('TC-06 [G1/AC1, G1/AC8] results shortcut enables mode without submitting', async ({ page }) => {
    await search(page, 'Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    await expect(page.getByText('Find books by ideas, themes and meaning')).toBeVisible(); await page.getByRole('button', { name: 'Explore with AI' }).click();
    await expect(page.getByRole('switch', { name: 'Explore with AI' })).toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('Dune'); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
  });
  test('TC-07 [G1/AC3, G1/AC9, G3/AC7] no-results shortcut submits once', async ({ page }) => {
    await search(page, 'books about quantum physics'); await page.getByRole('button', { name: 'Try exploring by meaning' }).click();
    await expect(page.getByText('No relevant books in your library')).toBeVisible(); await expect(page.getByRole('switch', { name: 'Explore with AI' })).toBeChecked(); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(1);
  });
  test('TC-08 [G7/AC1, G7/AC2, G7/AC6] error retries or returns to keyword search', async ({ page }) => {
    const unavailable = async (route: import('@playwright/test').Route) => route.fulfill({ status: 502, contentType: 'application/problem+json', body: JSON.stringify({ type: 'Explore.Unavailable' }) });
    await turnOn(page); await page.route('**/api/books/explore', unavailable); await submit(page, 'Dune');
    await expect(page.getByText('AI search is unavailable right now.')).toBeVisible(); await expect(page.getByTestId('book-card')).toHaveCount(0);
    await page.unroute('**/api/books/explore', unavailable); await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    await page.route('**/api/books/explore', unavailable); await submit(page, 'Dune'); await page.getByRole('button', { name: 'Search by keyword instead' }).click();
    await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
  });
  test('TC-09 [G2/AC4] blank and overlong prompts do not submit', async ({ page }) => {
    await turnOn(page); await submit(page, '   '); await submit(page, 'x'.repeat(501)); await expect(page.getByRole('alert')).toHaveText('Please enter 500 characters or fewer.'); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
  });
  test('TC-10 [G6/AC11, G9/AC2, G9/AC3] non-Pro entry points show disclosure', async ({ page }) => {
    const panel = page.getByRole('region', { name: 'Explore with AI Pro' });
    const checkPanel = async () => { await expect(panel).toContainText('Explore with AI is a Pro feature'); await expect(panel).toContainText('Pro cannot be purchased yet'); await expect(panel).toContainText(proDisclosure); await expect(panel.getByRole('button', { name: /purchase|upgrade/i })).toHaveCount(0); await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked(); };
    await page.getByRole('switch', { name: 'Explore with AI' }).click(); await checkPanel(); await page.getByRole('button', { name: 'Dismiss' }).click();
    await search(page, 'Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible(); await page.getByRole('button', { name: 'Explore with AI' }).click(); await checkPanel(); await page.getByRole('button', { name: 'Dismiss' }).click();
    await search(page, 'quantum physics'); await page.getByRole('button', { name: 'Try exploring by meaning' }).click(); await checkPanel(); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
  });
  test('TC-11 [G2/AC16] reload discards AI state and prompt is absent from URL', async ({ page }) => {
    await turnOn(page); await submit(page, 'Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible(); expect(page.url()).not.toContain('Dune');
    await page.reload(); await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('');
  });
  test('TC-12 [G3/AC10] truncated list is identified as top matches', async ({ page }) => {
    await turnOn(page); await page.route('**/api/books/explore', async route => { const response = await route.fetch(); const body = await response.json(); await route.fulfill({ response, json: { ...body, truncated: true } }); });
    await submit(page, 'Dune'); await expect(page.getByText(/Showing only the top \d+ matches/)).toBeVisible();
  });
  test('TC-13 [G6/AC7, G6/AC2] non-Pro and anonymous requests are denied', async ({ playwright }) => {
    const forbidden = await api.post(`${API}/books/explore`, { data: { prompt: 'Dune' } }); expect(forbidden.status()).toBe(403); expect((await forbidden.json()).type).toBe('Explore.ProRequired');
    const anonymous = await playwright.request.newContext(); const response = await anonymous.post(`${API}/books/explore`, { data: { prompt: 'Dune' } }); expect(response.status()).toBe(401); await anonymous.dispose();
  });
});
