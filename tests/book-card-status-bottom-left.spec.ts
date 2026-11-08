import { deflateSync } from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';
import { newTestAccount } from './support/credentials';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080/api';

type Seed = {
  key: string;
  title: string;
  authors?: string;
  cover: 'png' | 'none';
  status: 0 | 1 | 2;
};

const SEEDS: Seed[] = [
  { key: 'B1', title: 'The Long Afternoon of the Patient Cartographer and His Maps', authors: 'Ada North', cover: 'png', status: 0 },
  { key: 'B2', title: 'Dusk', cover: 'none', status: 1 },
  { key: 'B3', title: 'A Very Long Title That Must Wrap Onto Two Lines In Every Grid', authors: 'Ben South', cover: 'none', status: 2 },
  { key: 'B4', title: 'Ink', authors: 'Cy East', cover: 'png', status: 0 },
  { key: 'B5', title: 'Another Unusually Long Book Title For Wrapping Across Lines', cover: 'png', status: 1 },
  { key: 'B6', title: 'Tide', authors: 'Di West', cover: 'png', status: 2 },
  { key: 'B7', title: 'Notes From a Remarkably Long Journey Through the Quiet Hills', authors: 'Ed Hill', cover: 'none', status: 0 },
  { key: 'B8', title: 'Moss', cover: 'none', status: 1 },
];

const VIEWPORTS = [
  { width: 375, height: 812, columns: 2 },
  { width: 800, height: 900, columns: 3 },
  { width: 1100, height: 900, columns: 4 },
  { width: 1300, height: 900, columns: 5 },
  { width: 1600, height: 1000, columns: 6 },
];

const TOLERANCE = 1;
// p-4 (16px) card padding plus the 1px card border
const BOTTOM_INSET = 17;
const MIN_GAP = 8;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function solidPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x7a)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: ReturnType<Page['locator']>): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b as Box;
}

type CardInfo = {
  card: Box;
  poster: Box;
  title: Box;
  author: Box;
  status: Box;
  authorText: string;
};

async function readCards(page: Page): Promise<CardInfo[]> {
  const cards = page.getByTestId('book-card');
  await expect(cards).toHaveCount(SEEDS.length);
  const out: CardInfo[] = [];
  for (let i = 0; i < SEEDS.length; i++) {
    const card = cards.nth(i);
    const title = card.getByRole('heading', { level: 3 });
    const author = card.locator('p'); // the author line is the only paragraph in a grid card
    out.push({
      card: await box(card),
      poster: await box(card.getByTestId('book-card-poster')),
      title: await box(title),
      author: await box(author),
      // the wrapper carries pt-2, so measure the badge element inside it
      status: await box(card.getByTestId('book-card-status').locator(':scope > *')),
      authorText: (await author.textContent()) ?? '',
    });
  }
  return out;
}

function groupRows(cards: CardInfo[]): CardInfo[][] {
  const rows: CardInfo[][] = [];
  for (const c of cards) {
    const row = rows.find((r) => Math.abs(r[0].card.y - c.card.y) <= TOLERANCE);
    if (row) row.push(c);
    else rows.push([c]);
  }
  return rows;
}

function bottom(b: Box): number {
  return b.y + b.height;
}

function expectMixedTitles(row: CardInfo[]) {
  const heights = row.map((c) => Math.round(c.title.height));
  expect(new Set(heights).size, `row must mix one- and two-line titles, got ${heights}`).toBeGreaterThan(1);
}

function expectAlignedBadges(rows: CardInfo[][]) {
  for (const row of rows) {
    if (row.length < 2) continue;
    expectMixedTitles(row);
    const ref = bottom(row[0].status);
    for (const c of row) expect(Math.abs(bottom(c.status) - ref)).toBeLessThanOrEqual(TOLERANCE);
  }
}

test.describe('Book card status badge pinned to bottom-left', () => {
  const account = newTestAccount();
  let token = '';
  const ids: Record<string, string> = {};
  let abortedCoverUrl = '';

  test.beforeAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_BASE_URL.replace(/\/?$/, '/') });
    const reg = await api.post('auth/register', { data: account });
    expect(reg.ok()).toBeTruthy();
    token = (await reg.json()).accessToken;

    for (const seed of SEEDS) {
      const multipart: Record<string, string | number | boolean | { name: string; mimeType: string; buffer: Buffer }> = {
        Title: seed.title,
        Status: seed.status,
      };
      if (seed.authors) multipart.Authors = seed.authors;
      if (seed.cover === 'png') {
        multipart.ImageFile = { name: `${seed.key}.png`, mimeType: 'image/png', buffer: solidPng(40, 60) };
      }
      const res = await api.post('books', { headers: { Authorization: `Bearer ${token}` }, multipart });
      expect(res.ok(), `create ${seed.key}`).toBeTruthy();
      const created = await res.json();
      ids[seed.key] = created.id;
      if (seed.key === 'B4') abortedCoverUrl = created.coverImageUrl;
    }
    await api.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: API_BASE_URL.replace(/\/?$/, '/') });
    for (const id of Object.values(ids)) {
      await api.delete(`books/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    }
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    expect(abortedCoverUrl).toBeTruthy();
    await page.route(abortedCoverUrl, (route) => route.abort());
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/auth');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('book-card')).toHaveCount(SEEDS.length);
  });

  test('TC-01 badge sits at the card bottom-left under the text', async ({ page }) => {
    for (const c of await readCards(page)) {
      expect(Math.abs(c.status.x - c.title.x)).toBeLessThanOrEqual(TOLERANCE);
      expect(c.status.y).toBeGreaterThanOrEqual(bottom(c.author) - TOLERANCE);
      expect(Math.abs(bottom(c.card) - bottom(c.status) - BOTTOM_INSET)).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  test('TC-02 badges align across a row with mixed title lengths and a missing author', async ({ page }) => {
    const cards = await readCards(page);
    const rows = groupRows(cards);
    expect(rows.some((row) => row.some((c) => c.authorText === 'Unknown Author'))).toBe(true);
    expectAlignedBadges(rows);
  });

  test('TC-03 badges and posters stay aligned with loaded, missing and failed covers', async ({ page }) => {
    await expect(page.getByTestId('book-card').filter({ hasText: 'No cover' }).first()).toBeVisible();
    const aborted = page.getByTestId('book-card').filter({ hasText: 'Ink' });
    await expect
      .poll(() => aborted.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 0))
      .toBe(true);
    const loaded = page.getByTestId('book-card').filter({ hasText: 'Tide' }).locator('img');
    await expect
      .poll(() => loaded.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);

    const rows = groupRows(await readCards(page));
    const inkY = (await box(aborted)).y;
    const sameRow = async (cardsInPage: ReturnType<Page['locator']>) => {
      const n = await cardsInPage.count();
      for (let i = 0; i < n; i++) if (Math.abs((await box(cardsInPage.nth(i))).y - inkY) <= TOLERANCE) return true;
      return false;
    };
    expect(await sameRow(page.getByTestId('book-card').filter({ hasText: 'No cover' }))).toBe(true);
    expect(await sameRow(page.getByTestId('book-card').filter({ has: page.locator('img[src]') }).filter({ hasText: /^(?!.*Ink)/s }))).toBe(true);
    expectAlignedBadges(rows);
    for (const row of rows) {
      for (const c of row) {
        expect(Math.abs(c.poster.height - row[0].poster.height)).toBeLessThanOrEqual(TOLERANCE);
        expect(Math.abs(c.poster.height - c.poster.width * 1.5)).toBeLessThanOrEqual(TOLERANCE);
      }
    }
  });

  test('TC-04 two-line titles never collide with the author or the badge', async ({ page }) => {
    const cards = await readCards(page);
    const twoLine = cards.filter((c) => c.title.height > cards.reduce((m, x) => Math.min(m, x.title.height), Infinity) * 1.5);
    expect(twoLine.length).toBeGreaterThan(0);
    for (const c of twoLine) {
      expect(bottom(c.title)).toBeLessThanOrEqual(c.author.y + TOLERANCE);
      expect(bottom(c.author) + MIN_GAP).toBeLessThanOrEqual(c.status.y + TOLERANCE);
      for (const part of [c.title, c.author, c.status]) {
        expect(part.y).toBeGreaterThanOrEqual(c.card.y);
        expect(bottom(part)).toBeLessThanOrEqual(bottom(c.card));
      }
    }
    const lineClamps = await page
      .getByTestId('book-card')
      .first()
      .getByRole('heading', { level: 3 })
      .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));
    expect(lineClamps).toBe('2');
  });

  test('TC-05 hover actions stay on the poster and clicking opens the book', async ({ page }) => {
    const b1 = page.getByTestId('book-card').filter({ hasText: SEEDS[0].title });
    const poster = b1.getByTestId('book-card-poster');
    await poster.hover();
    const edit = poster.locator('button').first();
    const del = poster.locator('button').nth(1);
    await expect(edit).toBeVisible();
    await expect(del).toBeVisible();
    const p = await box(poster);
    for (const b of [await box(edit), await box(del)]) {
      expect(b.x).toBeGreaterThanOrEqual(p.x);
      expect(b.y).toBeGreaterThanOrEqual(p.y);
      expect(b.x + b.width).toBeLessThanOrEqual(p.x + p.width);
      expect(bottom(b)).toBeLessThanOrEqual(bottom(p));
    }
    const clamp = await b1
      .getByRole('heading', { level: 3 })
      .evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));
    expect(clamp).toBe('2');
    const authorClamp = await b1.locator('p').evaluate((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp'));
    expect(authorClamp).toBe('1');

    await page.mouse.move(0, 0);
    await page.getByTestId('book-card').filter({ hasText: SEEDS[2].title }).getByRole('heading', { level: 3 }).click();
    await expect(page).toHaveURL(new RegExp(`/book/${ids.B3}$`));
  });

  test('TC-06 badges align at every column count', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const grid = page.getByTestId('book-card').first().locator('xpath=..'); // the grid container is the card's parent
      await expect
        .poll(() => grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length))
        .toBe(vp.columns);
      expectAlignedBadges(groupRows(await readCards(page)));
    }
  });
});
