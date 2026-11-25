import assert from 'node:assert/strict';
import test from 'node:test';
import { CARDS, excludedWords } from '../app/lib/chinaBinder/cards.ts';
import { addHistory, bestTrend, median, parsePriceCharting, rawAsking, soldTrend, trackedTrend } from '../app/lib/chinaBinder/market.ts';

// Trimmed from a real PriceCharting card page: the price table and two sales tables.
const row = (id, date, title, price, listed = '&nbsp;') => `
  <tr id="ebay-${id}">
    <td class="date">${date}</td>
    <td class="image"><div class="image"><img src="/images/lock.gif"></div></td>
    <td class="title">
      <a target="_blank" class="js-ebay-completed-sale" href="https://www.ebay.com/itm/${id}?nordt=true&amp;campid=1">
        ${title}</a> [eBay]
    </td>
    <td class="numeric"> <span class="js-price" >${price}</span> </td>
    <td class="numeric listed-price">${listed}</td>
  </tr>`;
const PAGE = `
<table id="price_data"><tr>
  <td id="used_price">
      <span class="price js-price">
      $314.00
      </span>
  </td>
  <td id="graded_price"><span class="price js-price">$326.92</span></td>
  <td id="manual_only_price"><span class="price js-price">$432.00</span></td>
</tr></table>
<div class="completed-auctions-used"><table>
  <tr><th>Sale Date</th></tr>
  ${row(1, '2026-11-20', 'Arcanine ex SAR CSV3C-155/130 Chinese &amp; NM', '$300.00')}
  ${row(2, '2026-11-15', 'Arcanine ex 155/130 SAR', '$310.00', '<span class="js-price">$359.99</span>')}
  ${row(3, '2026-11-05', 'Arcanine ex CSV3C 155', '$280.00')}
  ${row(4, '2026-11-01', 'Arcanine ex CSV3C 155', '$260.00')}
</table></div>
<div class="completed-auctions-manual-only"><table>
  ${row(9, '2026-11-18', 'Arcanine EX PSA 10', '$445.00')}
</table></div>`;

test('reads PriceCharting prices and sales, newest first', () => {
  const pc = parsePriceCharting(PAGE);
  assert.equal(pc.ungraded, 314);
  assert.equal(pc.grade9, 326.92);
  assert.equal(pc.psa10, 432);
  assert.equal(pc.raw.length, 4);
  assert.deepEqual(pc.raw[0], { date: '2026-11-20', price: 300, title: 'Arcanine ex SAR CSV3C-155/130 Chinese & NM', url: 'https://www.ebay.com/itm/1' });
  assert.equal(pc.raw[1].price, 310, 'the sold price, not the crossed-out asking price');
  assert.equal(pc.graded10.length, 1);
});

test('a page without the tables gives empty data instead of failing', () => {
  const pc = parsePriceCharting('<html><body>Not found</body></html>');
  assert.deepEqual(pc, { ungraded: null, grade9: null, psa10: null, raw: [], graded10: [] });
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test('sold trend compares the last 14 days with the 14 before', () => {
  const pc = parsePriceCharting(PAGE);
  const trend = soldTrend(pc.raw, '2026-11-25');
  assert.equal(trend.nNow, 2); // 20th and 15th
  assert.equal(trend.nBefore, 2); // 5th and 1st
  assert.equal(trend.now, 305);
  assert.equal(trend.before, 270);
  assert.equal(trend.pct, 13);
  assert.equal(trend.dir, 'up');
  assert.equal(trend.grade, 'raw');
});

test('one sale in a window is not enough to call a direction', () => {
  const sales = [
    { date: '2026-11-20', price: 100, title: '', url: null },
    { date: '2026-11-21', price: 100, title: '', url: null },
    { date: '2026-11-05', price: 200, title: '', url: null },
  ];
  const trend = soldTrend(sales, '2026-11-25');
  assert.equal(trend.dir, 'none');
  assert.equal(trend.pct, null);
});

test('small moves are flat', () => {
  const sales = ['2026-11-20', '2026-11-21', '2026-11-05', '2026-11-06'].map((date, i) => ({ date, price: i < 2 ? 101 : 100, title: '', url: null }));
  assert.equal(soldTrend(sales, '2026-11-25').dir, 'flat');
});

test('falls back from raw sales to PSA 10 sales to tracked readings', () => {
  const pc = { ungraded: 50, grade9: null, psa10: 200, raw: [], graded10: [
    { date: '2026-11-24', price: 220, title: '', url: null },
    { date: '2026-11-23', price: 220, title: '', url: null },
    { date: '2026-11-04', price: 200, title: '', url: null },
    { date: '2026-11-03', price: 200, title: '', url: null },
  ] };
  const psa = bestTrend(pc, [], '2026-11-25');
  assert.equal(psa.grade, 'psa10');
  assert.equal(psa.dir, 'up');

  const history = [{ d: '2026-11-11', raw: 40 }, { d: '2026-11-18', raw: 45 }, { d: '2026-11-25', raw: 36 }];
  const tracked = bestTrend({ ...pc, graded10: [] }, history, '2026-11-25');
  assert.equal(tracked.basis, 'tracked');
  assert.equal(tracked.dir, 'down');
  assert.equal(tracked.pct, -10);
});

test('tracked trend needs a reading at least 10 days old and a recent one', () => {
  assert.equal(trackedTrend([{ d: '2026-11-20', ask: 10 }, { d: '2026-11-25', ask: 12 }], 'ask', '2026-11-25', 'asking').pct, null);
  assert.equal(trackedTrend([{ d: '2026-11-01', ask: 10 }, { d: '2026-11-15', ask: 12 }], 'ask', '2026-11-25', 'asking').pct, null);
  assert.equal(trackedTrend([{ d: '2026-11-11', ask: 10 }, { d: '2026-11-24', ask: 12 }], 'ask', '2026-11-25', 'asking').pct, 20);
});

test('history keeps one reading per day and the most recent days', () => {
  let history = [];
  for (let day = 1; day <= 5; day++) history = addHistory(history, { d: `2026-11-0${day}`, raw: day }, 3);
  history = addHistory(history, { d: '2026-11-05', raw: 9 }, 3);
  assert.deepEqual(history.map((p) => [p.d, p.raw]), [['2026-11-03', 3], ['2026-11-04', 4], ['2026-11-05', 9]]);
});

test('eBay asking prices keep only ungraded listings of this exact card', () => {
  const card = CARDS.find((c) => c.id === 'cbb3c-307');
  const listings = [
    { title: 'Pokemon Chinese Gem Pack Vol 3 Gengar 307/07 Illustration Rare NM', price: 95, url: 'a' },
    { title: 'Gengar IR CBB3C 0307/07 Simplified Chinese exclusive', price: 99, url: 'b' },
    { title: 'Gengar Gem Pack Vol 3 PSA 10 Chinese 307', price: 260, url: 'graded' },
    { title: 'Gengar Gem Pack Vol 3 Master Ball Chinese', price: 12, url: 'variant' },
    { title: 'Gengar Gem Pack Vol 3 307 Chinese proxy custom card', price: 5, url: 'junk' },
    { title: 'Gengar 307 Japanese', price: 90, url: 'not chinese' },
    { title: 'Haunter Gem Pack Vol 3 Chinese art rare', price: 20, url: 'other card' },
    { title: 'Chinese Gem Pack 3 Gengar 307 illustration rare', price: 20, url: 'too cheap' },
  ];
  const kept = rawAsking(listings, card.must, excludedWords(card), 91).map((l) => l.url);
  assert.deepEqual(kept, ['a', 'b']);
});

test('a card number has to match as a whole number', () => {
  const card = CARDS.find((c) => c.id === 'csv3c-155');
  const kept = rawAsking([
    { title: 'Chinese Arcanine ex CSV3C-155/130 SAR', price: 300, url: 'yes' },
    { title: 'Chinese Arcanine ex 1550 SAR', price: 300, url: 'no' },
  ], card.must, excludedWords(card), null);
  assert.deepEqual(kept.map((l) => l.url), ['yes']);
});

test('every card has a scan, a PriceCharting page and a unique id', () => {
  assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length);
  for (const card of CARDS) {
    assert.match(card.pc, /^pokemon-chinese-[a-z0-9-]+\/[a-z0-9%-]+$/, card.id);
    assert.ok(card.img && card.must.length >= 2, card.id);
  }
});
