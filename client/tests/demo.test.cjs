const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/demoApi.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function loadDemo(storage = new Map()) {
  const sandbox = {
    exports: {}, URL,
    window: { location: { href: 'https://bonbook2026.github.io/BonBook/#/order-summary' } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    fetch: () => { throw new Error('The preview must never call a backend.'); },
  };
  vm.runInNewContext(compiled, sandbox);
  const { demoRequest, resetDemoState } = sandbox.exports;
  return {
    storage, resetDemoState,
    request: (route, method = 'GET', body, token = null) =>
      demoRequest(route, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, token),
    login: () => demoRequest('/auth/local-telegram', { method: 'POST' }, null),
  };
}

test('demo login works without Telegram and rejects real or absent API credentials', async () => {
  const demo = loadDemo();
  assert.equal((await demo.request('/auth/local-telegram')).enabled, true);
  await assert.rejects(demo.request('/users/profile'), /حساب آزمایشی/);
  await assert.rejects(demo.request('/users/profile', 'GET', undefined, 'real-production-jwt'), /حساب آزمایشی/);
  const auth = await demo.login();
  assert.equal(auth.user.telegramId, 'preview:telegram:bonbook');
  assert.equal(auth.profileComplete, true);
  assert.equal((await demo.request('/users/profile', 'GET', undefined, auth.token)).user.email, 'reader@example.com');
  await assert.rejects(demo.request('/auth/login', 'POST', { initData: 'signed-real-data' }, auth.token), /در دسترس نیست/);
});

test('profile and book validation block incomplete or invalid orders', async () => {
  const demo = loadDemo();
  const { token } = await demo.login();
  await assert.rejects(demo.request('/users/profile', 'PUT', { email: 'invalid' }, token), /ایمیل معتبر/);
  for (const books of [[], [null], [{ title: '' }], Array.from({ length: 11 }, () => ({ title: 'Book' }))]) {
    await assert.rejects(demo.request('/orders', 'POST', { books }, token), /عنوان کتاب/);
  }
  await demo.request('/users/profile', 'PUT', { email: '' }, token);
  await assert.rejects(demo.request('/orders', 'POST', { books: [{ title: 'Book' }] }, token), /پروفایل ناقص/);
  assert.equal((await demo.request('/orders', 'GET', undefined, token)).orders.length, 0);
});

test('checkout preserves totals and paid history on reload without a payment or delivery service', async () => {
  const demo = loadDemo();
  const { token } = await demo.login();
  const { order } = await demo.request('/orders', 'POST', { books: [{ title: ' Book A ' }, { title: 'Book B' }] }, token);
  assert.equal(order.totalBooks, 2);
  assert.equal(order.books[0].title, 'Book A');
  assert.equal(order.totalUsd, 16);
  assert.equal(order.totalIrr, order.totalUsd * order.exchangeRate);
  const payment = await demo.request('/payments/initiate', 'POST', { orderId: order.id }, token);
  const destination = new URL(payment.paymentUrl);
  assert.equal(destination.origin, 'https://bonbook2026.github.io');
  assert.equal(destination.pathname, '/BonBook/');
  assert.equal(destination.hash, '#/success?order=DEMO-0001');
  const reloaded = loadDemo(demo.storage);
  const history = await reloaded.request('/orders', 'GET', undefined, token);
  assert.equal(history.orders[0].status, 'PAID');
  assert.ok(history.orders[0].paidAt);
  assert.equal(history.orders[0].deliveryStatus, null);
  await assert.rejects(reloaded.request('/payments/initiate', 'POST', { orderId: 999 }, token), /یافت نشد/);
});

test('each browser starts separately and reset clears saved profile and orders', async () => {
  const demo = loadDemo();
  const { token } = await demo.login();
  await demo.request('/users/profile', 'PUT', { firstName: 'همکار' }, token);
  await demo.request('/orders', 'POST', { books: [{ title: 'Book' }] }, token);
  const otherBrowser = loadDemo();
  assert.equal((await otherBrowser.login()).user.firstName, 'کاربر');
  assert.equal((await otherBrowser.request('/orders', 'GET', undefined, token)).orders.length, 0);
  demo.resetDemoState();
  const reloaded = loadDemo(demo.storage);
  assert.equal((await reloaded.login()).user.firstName, 'کاربر');
  assert.equal((await reloaded.request('/orders', 'GET', undefined, token)).orders.length, 0);
});
