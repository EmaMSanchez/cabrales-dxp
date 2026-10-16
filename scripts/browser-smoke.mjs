import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseURL = process.env.CAFE_TEST_URL || 'https://localhost:4321/';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const output = resolve('reports/screenshots');
await mkdir(output, { recursive: true });

async function capture(page, name) {
  await page.screenshot({ path: resolve(output, name), animations: 'disabled' });
}

async function frameAt(page, ratio) {
  await page.evaluate((fraction) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const film = document.querySelector('.coffee-film');
    const max = film.getBoundingClientRect().height - window.innerHeight;
    window.scrollTo(0, Math.round(max * fraction));
  }, ratio);
  await page.waitForFunction((fraction) => {
    const video = document.querySelector('.coffee-film__video');
    const line = document.querySelector('.coffee-film__progress span');
    const actual = Number((line?.style.transform.match(/scaleX\(([^)]+)/) || [])[1]);
    const film = document.querySelector('.coffee-film');
    const distance = film.getBoundingClientRect().height - innerHeight;
    const position = Math.max(0, Math.min(1, scrollY / distance));
    return video && video.readyState >= 2 && !video.seeking && Number.isFinite(actual) && Math.abs(position - fraction) < .015 && Math.abs(video.currentTime / video.duration - actual) < .012;
  }, ratio, { timeout: 20000 });
  // El seeked/currentTime puede llegar antes que el fotograma nuevo al compositor de Chrome.
  await page.waitForTimeout(400);
  return page.locator('video').evaluate((video) => ({ time: video.currentTime, duration: video.duration, paused: video.paused }));
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  desktop.on('pageerror', (error) => errors.push(`desktop: ${error.message}`));
  await desktop.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await desktop.waitForSelector('.coffee-film.is-video-ready', { timeout: 25000 });
  const first = await frameAt(desktop, 0);
  await capture(desktop, 'desktop-intro.png');
  const macro = await frameAt(desktop, .43);
  await capture(desktop, 'desktop-macro.png');
  const end = await frameAt(desktop, 1);
  await capture(desktop, 'desktop-end.png');
  const reverse = await frameAt(desktop, .26);
  const reset = await frameAt(desktop, 0);

  if (!(macro.time > 6 && macro.time < 8.5 && end.time > end.duration - .25 && reverse.time < macro.time && reset.time < .15)) {
    throw Error(`El scrub no avanzó y retrocedió correctamente: ${JSON.stringify({ first, macro, end, reverse, reset })}`);
  }
  if ([first, macro, end, reverse, reset].some((sample) => !sample.paused)) throw Error('El video se está reproduciendo sin scroll.');
  const macroCaption = await frameAt(desktop, .43);
  const visibleCaption = await desktop.locator('[data-coffee-scene="2"]').evaluate((scene) => ({ opacity: +getComputedStyle(scene).opacity, text: scene.textContent }));
  if (!visibleCaption.text.includes('Cada grano') || visibleCaption.opacity < .5) throw Error('El texto del macro no está sincronizado.');
  console.log('SCRUB ' + JSON.stringify({ first, macro, end, reverse, reset, visibleCaption, macroCaption }));
  const nearEnd = await frameAt(desktop, .95);
  const beforeReloadY = await desktop.evaluate(() => scrollY);
  await desktop.reload({ waitUntil: 'domcontentloaded' });
  await desktop.waitForSelector('.coffee-film.is-video-ready', { timeout: 25000 });
  await desktop.waitForFunction(({ y, time }) => Math.abs(scrollY - y) < 25 && Math.abs(document.querySelector('video').currentTime - time) < .5, { y: beforeReloadY, time: nearEnd.time }, { timeout: 15000 });
  console.log('RESTORE ' + JSON.stringify({ before: { y: beforeReloadY, time: nearEnd.time }, after: await desktop.evaluate(() => ({ y: scrollY, time: document.querySelector('video').currentTime })) }));
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-tagline').offsetTop + 100));
  await desktop.waitForTimeout(350);
  await capture(desktop, 'desktop-editorial.png');
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--opening').offsetTop + 150));
  await desktop.waitForTimeout(850);
  await capture(desktop, 'desktop-opening.png');

  for (const width of [390, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    mobile.on('pageerror', (error) => errors.push(`${width}px: ${error.message}`));
    await mobile.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await mobile.waitForSelector('.coffee-film.is-video-ready', { timeout: 25000 });
    const sizes = await mobile.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, film: document.querySelector('.coffee-film__stage').getBoundingClientRect().width }));
    if (sizes.page > sizes.viewport + 1) throw Error(`Desbordamiento horizontal en ${width}px: ${JSON.stringify(sizes)}`);
    await capture(mobile, `mobile-${width}.png`);
    const halfway = await frameAt(mobile, .49);
    await frameAt(mobile, 1);
    await capture(mobile, `mobile-${width}-end.png`);
    console.log('MOBILE ' + JSON.stringify({ width, ...sizes, halfway }));
    await mobile.close();
  }

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  await reduced.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await reduced.waitForSelector('.coffee-film');
  const reducedState = await reduced.evaluate(() => ({ enhanced: document.querySelector('.coffee-film').classList.contains('is-enhanced'), videoSrc: document.querySelector('.coffee-film__video').getAttribute('src'), h1: document.querySelector('h1')?.textContent, editorial: !!document.querySelector('.coffee-panel') }));
  if (reducedState.enhanced || reducedState.videoSrc || !reducedState.editorial) throw Error('La alternativa de movimiento reducido no estática falló.');
  console.log('REDUCED ' + JSON.stringify(reducedState));
  await reduced.close();

  const staticPage = await browser.newPage({ javaScriptEnabled: false, ignoreHTTPSErrors: true });
  const response = await staticPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const staticState = await staticPage.evaluate(() => ({ title: document.querySelector('h1')?.textContent, poster: document.querySelector('.coffee-film__poster')?.getAttribute('src'), editorial: document.querySelectorAll('.coffee-panel').length, videoSrc: document.querySelector('video')?.getAttribute('src') }));
  if (response.status() !== 200 || !staticState.poster || !staticState.editorial || staticState.videoSrc) throw Error('La alternativa sin JavaScript falló.');
  console.log('NO_JS ' + JSON.stringify(staticState));
  await staticPage.close();

  const broken = await browser.newPage({ ignoreHTTPSErrors: true });
  await broken.route('**/videos/cafe-recorrido.mp4', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'No disponible' }));
  await broken.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await broken.waitForSelector('.coffee-film.is-video-error', { timeout: 15000 });
  const errorState = await broken.evaluate(() => ({ editorial: document.querySelectorAll('.coffee-panel').length, status: document.querySelector('.coffee-film__status').textContent, posterOpacity: getComputedStyle(document.querySelector('.coffee-film__poster')).opacity, filmHeight: document.querySelector('.coffee-film').getBoundingClientRect().height }));
  if (!errorState.editorial || !errorState.status.includes('no está disponible') || errorState.filmHeight > 1200) throw Error('El fallback para un video caído falló.');
  console.log('VIDEO_ERROR ' + JSON.stringify(errorState));
  await broken.close();

  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS — Capturas en reports/screenshots/');
} finally {
  await browser.close();
}
