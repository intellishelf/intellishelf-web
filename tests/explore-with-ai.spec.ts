import fs from 'node:fs';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// The verifier creates isolated synthetic accounts and saves their authenticated browser states.
const PRO = process.env.E2E_PRO_STATE ?? '.auth/explore-pro.json';
const NON_PRO = process.env.E2E_NON_PRO_STATE ?? '.auth/explore-non-pro.json';
const SECOND_PRO = process.env.E2E_SECOND_PRO_STATE ?? '.auth/explore-second-pro.json';
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
  await expect(page).not.toHaveURL(/\/auth/);
  await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
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
  let exploreBodies: unknown[];
  let countRequests: string[];
  let ownerId: string;
  let exploreOwners: string[];
  test.beforeEach(async ({ playwright, page }, testInfo) => {
    api = null!; ids = [];
    const nonPro = /TC-10|TC-13/.test(testInfo.title);
    const state = nonPro ? NON_PRO : PRO;
    test.skip(!fs.existsSync(state), `Needs verifier-created synthetic account state: ${state}`);
    await page.context().addCookies(JSON.parse(fs.readFileSync(state, 'utf8')).cookies);
    api = await playwright.request.newContext({ storageState: state });
    const me = await api.get(`${API}/auth/me`);
    test.skip(me.status() === 401, `${state} has expired; verifier must refresh it`);
    expect(me.ok(), `current-user request returned ${me.status()}`).toBeTruthy();
    const user = await me.json();
    ownerId = user.id;
    expect(!!user.isPro).toBe(!nonPro);
    const library = await api.get(`${API}/books?page=1&pageSize=1`);
    expect(library.ok(), `library setup returned ${library.status()}`).toBeTruthy();
    expect((await library.json()).totalCount, 'Verifier must supply a fresh, empty disposable account').toBe(0);
    requests = []; exploreBodies = []; countRequests = []; exploreOwners = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/api/books' && url.searchParams.get('pageSize') === '1') countRequests.push(request.url());
      if (request.url().includes('/api/books/explore') || request.url().includes('/api/books/search')) requests.push(request.url());
      if (request.url().includes('/api/books/explore') && request.method() === 'POST') { exploreBodies.push(request.postDataJSON()); exploreOwners.push(request.headers()['x-explore-user-id']); }
    });
    if (!/TC-01|TC-13/.test(testInfo.title)) {
      if (nonPro) {
        ids.push(await seed(api, 'Dune'));
        await expect.poll(async () => {
          const response = await api.get(`${API}/books/search?searchTerm=Dune&page=1&pageSize=24`);
          if (!response.ok()) return false;
          const data = await response.json();
          return data.items.some((book: { title: string }) => book.title === 'Dune');
        }, { timeout: 30000 }).toBe(true);
      }
      else {
        ids.push(await seed(api, 'Dune', { Authors: 'Frank Herbert' }));
        ids.push(await seed(api, 'The Quiet Lighthouse', { Description: 'A keeper lives alone in solitude.' }));
        for (let i = 1; i <= 14; i++) ids.push(await seed(api, `Harbor Tales ${i}`));
        await expect.poll(async () => {
          const response = await api.post(`${API}/books/explore`, { headers: { 'X-Explore-User-Id': ownerId }, data: { prompt: 'Harbor' } });
          return response.ok() ? (await response.json()).items.length : 0;
        }, { timeout: 30000 }).toBe(14);
      }
    }
    await openLibrary(page, /TC-04/.test(testInfo.title) ? '/?pageSize=12' : '/');
  });
  test.afterEach(async () => {
    if (!api) return;
    const failures: number[] = [];
    for (const id of ids ?? []) {
      const response = await api.delete(`${API}/books/${id}`);
      if (!response.ok()) failures.push(response.status());
    }
    await api.dispose();
    expect(failures, 'Synthetic fixture cleanup must succeed').toEqual([]);
  });

  test('TC-01 [G2/AC17] empty library does not submit', async ({ page }) => {
    await turnOn(page); await submit(page, 'Dune');
    await expect(page.getByRole('heading', { name: 'No books in your library yet' })).toBeVisible();
    expect(requests.filter(url => url.includes('/explore'))).toHaveLength(0);
  });
  test('TC-02 [G1/AC6, G1/AC7, G2/AC3, G2/AC12, G2/AC16, G9/AC1] mode keeps text and does not search while typing', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: 'Explore with AI' });
    await expect(toggle).not.toBeChecked();
    const keywordResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/books/search' && new URL(response.url()).searchParams.get('searchTerm') === 'Dune');
    await search(page, 'Dune'); expect((await keywordResponse).ok()).toBeTruthy();
    await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    expect(requests.some(url => url.includes('/search'))).toBe(true);
    const before = await page.getByTestId('book-card').allTextContents();
    const count = requests.length;
    await test.step('Enable AI mode and check the existing results', async () => {
    await turnOn(page);
    await expect(page.getByLabel('Search books')).toHaveAttribute('placeholder', 'Describe ideas, themes or a book you liked');
    await expect(page.getByLabel('Search books')).toHaveValue('Dune');
    for (const example of examples) await expect(page.getByRole('button', { name: example })).toBeVisible();
    await expect(page.getByText(disclosure)).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('switch')).toHaveCount(1);
    await expect(page.getByTestId('book-card')).toHaveText(before);
    });
    await test.step('Type through the keyword debounce and verify no requests', async () => {
    await search(page, 'Dune more');
    // This case observes the 300 ms debounce interval to catch delayed requests.
    await page.waitForTimeout(500);
    expect(requests).toHaveLength(count);
    expect(page.url()).not.toContain('Dune');
    await expect(page.getByText(/lexical|vector|semantic|hybrid/i)).toHaveCount(0);
    });
    await test.step('Return to keyword mode and check the search request', async () => {
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/books/search' && new URL(r.url()).searchParams.get('searchTerm') === 'Dune more');
    await toggle.uncheck(); await expect(page.getByLabel('Search books')).toHaveValue('Dune more');
    expect((await response).ok()).toBeTruthy();
    expect(requests.slice(count).filter(url => new URL(url).pathname === '/api/books/explore')).toHaveLength(0);
    });
  });
  test('TC-03 [G2/AC2, G2/AC5, G2/AC6, G2/AC14, G3/AC6] chip submits once and results support both views', async ({ page }) => {
    await turnOn(page); await page.getByRole('button', { name: examples[1] }).click();
    await expect(page.getByLabel('Search books')).toHaveValue(examples[1]); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    let requestArrived!: () => void; const intercepted = new Promise<void>(resolve => { requestArrived = resolve; });
    await page.route('**/api/books/explore', async route => { requestArrived(); await gate; await route.continue(); });
    await page.getByLabel('Search books').press('Enter'); await intercepted; await expect(page.getByLabel('Loading results')).toBeVisible(); await expect(page.getByTestId('book-card')).toHaveCount(0); release();
    await expect(page.getByTestId('book-card').filter({ hasText: 'The Quiet Lighthouse' })).toBeVisible();
    for (const name of ['All', 'Unread', 'Reading', 'Read']) await expect(page.getByRole('tab', { name, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'List view' }).click(); await expect(page.getByTestId('book-card').filter({ hasText: 'The Quiet Lighthouse' })).toBeVisible();
    await expect(page.getByText(/% relevant|similarity score/i)).toHaveCount(0); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(1);
  });
  test('TC-04 [G2/AC19, G2/AC15, G3/AC10] paging and browser back preserve order without requests', async ({ page }) => {
    const beforeRequests = requests.length;
    await test.step('Submit Harbor and check the result count', async () => {
      await turnOn(page); await submit(page, 'Harbor'); await expect(page.getByText('14 books found')).toBeVisible();
    });
    await expect(page.getByTestId('book-card')).toHaveCount(12); const firstPage = await page.getByTestId('book-card').allTextContents(); await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByTestId('book-card')).toHaveCount(2); const order = await page.getByTestId('book-card').allTextContents(); expect(new Set([...firstPage, ...order]).size).toBe(14);
    await test.step('Change page size and preserve the full ordered list', async () => {
      await page.getByLabel('Per page:').click(); await page.getByRole('option', { name: '24', exact: true }).click();
      await expect(page.getByTestId('book-card')).toHaveText([...firstPage, ...order]);
      await page.getByLabel('Per page:').click(); await page.getByRole('option', { name: '12', exact: true }).click(); await page.getByRole('button', { name: '2', exact: true }).click();
      await expect(page.getByTestId('book-card')).toHaveText(order);
    });
    await page.getByTestId('book-card').filter({ hasText: order[0] }).click(); await expect(page).toHaveURL(/\/book\//); await page.goBack();
    await expect(page.getByRole('switch', { name: 'Explore with AI' })).toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('Harbor');
    await expect(page.getByTestId('book-card')).toHaveText(order); expect(requests.slice(beforeRequests).filter(x => new URL(x).pathname === '/api/books/explore')).toHaveLength(1);
    expect(requests.slice(beforeRequests).filter(x => new URL(x).pathname === '/api/books/search')).toHaveLength(0);
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
    const prompt = 'books about quantum physics';
    await test.step('Search by keyword and invoke the meaning shortcut', async () => {
      await search(page, prompt); await expect(page.getByRole('button', { name: 'Try exploring by meaning' })).toBeVisible();
      const keywordCount = requests.filter(x => new URL(x).pathname === '/api/books/search').length;
      await page.getByRole('button', { name: 'Try exploring by meaning' }).click();
      await expect(page.getByText('No relevant books in your library')).toBeVisible();
      await expect(page.getByRole('switch', { name: 'Explore with AI' })).toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue(prompt);
      expect(exploreBodies).toEqual([{ prompt }]);
      // Observe the debounce interval for any delayed keyword request after switching.
      await page.waitForTimeout(500);
      expect(requests.filter(x => new URL(x).pathname === '/api/books/search')).toHaveLength(keywordCount);
    });
  });
  test('TC-08 [G7/AC1, G7/AC2, G7/AC6] error retries or returns to keyword search', async ({ page }) => {
    const unavailable = async (route: import('@playwright/test').Route) => route.fulfill({ status: 502, contentType: 'application/problem+json', body: JSON.stringify({ type: 'Explore.Unavailable' }) });
    await turnOn(page); await page.route('**/api/books/explore', unavailable); await submit(page, 'Dune');
    await expect(page.getByText('AI search is unavailable right now.')).toBeVisible(); await expect(page.getByTestId('book-card')).toHaveCount(0);
    await page.unroute('**/api/books/explore', unavailable); await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    await page.route('**/api/books/explore', unavailable); await submit(page, 'Dune'); await page.getByRole('button', { name: 'Search by keyword instead' }).click();
    await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    expect(exploreOwners).toEqual([ownerId, ownerId, ownerId]);
  });
  test('TC-09 [G2/AC4] blank and overlong prompts do not submit', async ({ page }) => {
    await turnOn(page); await submit(page, '   '); await submit(page, 'x'.repeat(501)); await expect(page.getByRole('alert')).toHaveText('Please enter 500 characters or fewer.'); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
  });
  test('TC-10 [G6/AC11, G9/AC2, G9/AC3] non-Pro entry points show disclosure', async ({ page }) => {
    const panel = page.getByRole('region', { name: 'Explore with AI Pro' });
    const checkPanel = async () => { await expect(panel).toContainText('Explore with AI is a Pro feature'); await expect(panel).toContainText('Pro cannot be purchased yet'); await expect(panel).toContainText(proDisclosure); await expect(panel.getByRole('button', { name: /purchase|upgrade/i })).toHaveCount(0); await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked(); };
    await page.getByRole('switch', { name: 'Explore with AI' }).click(); await checkPanel(); await page.getByRole('button', { name: 'Dismiss' }).click();
    const keywordResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/books/search' && new URL(response.url()).searchParams.get('searchTerm') === 'Dune');
    await search(page, 'Dune'); expect((await keywordResponse).ok()).toBeTruthy(); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible(); await page.getByRole('button', { name: 'Explore with AI' }).click(); await checkPanel(); await page.getByRole('button', { name: 'Dismiss' }).click();
    await search(page, 'quantum physics'); await page.getByRole('button', { name: 'Try exploring by meaning' }).click(); await checkPanel(); expect(requests.filter(x => x.includes('/explore'))).toHaveLength(0);
  });
  test('TC-11 [G2/AC16] reload discards AI state and prompt is absent from URL', async ({ page }) => {
    await turnOn(page); await submit(page, 'Dune'); await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible(); expect(page.url()).not.toContain('Dune');
    await page.reload(); await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked(); await expect(page.getByLabel('Search books')).toHaveValue('');
  });
  test('TC-12 [G3/AC10] truncated list is identified as top matches', async ({ page }) => {
    await test.step('Simulate a truncated response and check both counts', async () => {
      await turnOn(page); await page.route('**/api/books/explore', async route => { const response = await route.fetch(); const body = await response.json(); expect(body.items.length).toBeGreaterThan(0); await route.fulfill({ response, json: { ...body, items: body.items.slice(0, 1), truncated: true } }); });
      await submit(page, 'Dune'); await expect(page.getByText('Showing only the top 1 matches', { exact: true })).toBeVisible();
      await expect(page.getByText('1 book found', { exact: true })).toHaveCount(0);
      await expect(page.getByText('1 displayed matches')).toBeVisible();
    });
  });
  test('TC-14 [review] an ordinary search failure does not hide successful Explore results', async ({ page }) => {
    await test.step('Confirm ordinary browsing does not fetch an extra count', async () => {
      await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
      expect(countRequests).toHaveLength(0);
    });
    await test.step('Fail the ordinary keyword search and turn AI mode on', async () => {
      await page.route('**/api/books/search**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
      await search(page, 'Dune');
      await expect(page.getByRole('heading', { name: 'No books found' })).toBeVisible();
      await turnOn(page);
      await expect(page.getByText('Unable to load your library.')).toBeVisible();
    });
    await test.step('Submit and show the real Explore result', async () => {
      await submit(page, 'Dune');
      await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
      await expect(page.getByText('Unable to load your library.')).toHaveCount(0);
      expect(exploreBodies).toEqual([{ prompt: 'Dune' }]);
      expect(countRequests).toHaveLength(1);
    });
  });
  test('TC-15 [review R2] a delayed edit preserves the current page and page size', async ({ page }) => {
    await turnOn(page); await submit(page, 'Harbor');
    await expect(page.getByText('14 books found')).toBeVisible();
    const headings = await page.getByTestId('book-card').getByRole('heading', { level: 3 }).allTextContents();
    expect(headings).toHaveLength(14);
    const targetTitle = headings[12];
    const bookNumber = Number(targetTitle.match(/^Harbor Tales (\d+)$/)?.[1]);
    expect(bookNumber).toBeGreaterThan(0);
    const card = page.getByTestId('book-card').filter({ has: page.getByRole('heading', { name: targetTitle, exact: true }) });
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    let arrived!: () => void; const refreshStarted = new Promise<void>(resolve => { arrived = resolve; });
    await page.route(`**/api/books/${ids[bookNumber + 1]}`, async route => {
      if (route.request().method() !== 'GET') return route.continue();
      arrived(); await gate; await route.continue();
    });
    await test.step('Save an edit and hold its refresh', async () => {
      await card.hover(); await card.getByRole('button', { name: 'Edit book' }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit Book' });
      await dialog.getByLabel('Title *').fill(`${targetTitle} edited`);
      await dialog.getByRole('button', { name: 'Update Book' }).click();
      await refreshStarted;
    });
    await test.step('Move to the second page before the refresh completes', async () => {
      await page.getByLabel('Per page:').click(); await page.getByRole('option', { name: '12', exact: true }).click();
      await page.getByRole('button', { name: '2', exact: true }).click();
      release();
      await expect(page.getByRole('heading', { name: `${targetTitle} edited`, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('book-card')).toHaveCount(2);
    });
  });
  test('TC-16 [security] an account change clears Library and Explore state', async ({ page, playwright }) => {
    test.skip(!fs.existsSync(SECOND_PRO), `Needs verifier-created synthetic account state: ${SECOND_PRO}`);
    const other = await playwright.request.newContext({ storageState: SECOND_PRO });
    let otherId: string | undefined;
    try {
      const me = await other.get(`${API}/auth/me`);
      test.skip(me.status() === 401, `${SECOND_PRO} has expired; verifier must refresh it`);
      expect(me.ok()).toBeTruthy(); expect((await me.json()).isPro).toBe(true);
      const library = await other.get(`${API}/books?page=1&pageSize=1`);
      expect(library.ok()).toBeTruthy(); expect((await library.json()).totalCount).toBe(0);
      otherId = await seed(other, 'Different account book');
      await test.step('Display the first account’s AI results', async () => {
        await turnOn(page); await submit(page, 'Harbor');
        await expect(page.getByText('14 books found')).toBeVisible();
      });
      await test.step('Switch the authenticated session and refresh entitlement', async () => {
        await page.context().clearCookies();
        await page.context().addCookies(JSON.parse(fs.readFileSync(SECOND_PRO, 'utf8')).cookies);
        const before = exploreBodies.length;
        const refreshed = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/me' && r.ok());
        await submit(page, 'Harbor'); await refreshed;
        await expect(page.getByTestId('book-card').filter({ hasText: 'Different account book' })).toBeVisible();
        await expect(page.getByTestId('book-card').filter({ hasText: 'Harbor Tales' })).toHaveCount(0);
        await expect(page.getByLabel('Search books')).toHaveValue('');
        await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked();
        expect(exploreBodies).toHaveLength(before);
      });
    } finally {
      if (otherId) expect((await other.delete(`${API}/books/${otherId}`)).ok(), 'Second account fixture cleanup must succeed').toBeTruthy();
      await other.dispose();
    }
  });
  test('TC-17 [security] session-change response purges the prompt and Library state', async ({ page }) => {
    await search(page, 'Dune');
    await expect(page.getByTestId('book-card').filter({ hasText: 'Dune' })).toBeVisible();
    await turnOn(page);
    await page.route('**/api/books/explore', route => route.fulfill({ status: 409, contentType: 'application/problem+json', body: JSON.stringify({ type: 'Explore.SessionChanged' }) }));
    await submit(page, 'private prompt');
    await expect(page.getByLabel('Search books')).toHaveValue('');
    await expect(page.getByRole('switch', { name: 'Explore with AI' })).not.toBeChecked();
    await expect(page.getByText('Your session changed. Please try again.')).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    expect(exploreBodies).toEqual([{ prompt: 'private prompt' }]);
    expect(exploreOwners).toEqual([ownerId]);
  });
  test('TC-13 [G6/AC7, G6/AC2] non-Pro and anonymous requests are denied', async ({ playwright }) => {
    const forbidden = await api.post(`${API}/books/explore`, { headers: { 'X-Explore-User-Id': ownerId }, data: { prompt: 'Dune' } }); expect(forbidden.status()).toBe(403); expect((await forbidden.json()).type).toBe('Explore.ProRequired');
    const anonymous = await playwright.request.newContext(); const response = await anonymous.post(`${API}/books/explore`, { data: { prompt: 'Dune' } }); expect(response.status()).toBe(401); await anonymous.dispose();
  });
});
