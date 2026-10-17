import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { coffeeContent } from '../src/lib/coffeeContent.js';

const exampleBuy = coffeeContent({ cta_link: { url: 'https://example.com/tienda' } });
if (exampleBuy.buyHref !== 'https://example.com/tienda' || exampleBuy.cta !== null || coffeeContent({ cta_link: { url: 'javascript:alert(1)' } }).buyHref) {
  throw Error('El destino de Comprar debe respetar el enlace seguro de Storyblok incluso sin texto de CTA.');
}
const detailFallback = coffeeContent().editorial.find((section) => section.name === 'detail').image;
const detailFromCms = coffeeContent({ detail_image: { filename: 'https://a.storyblok.com/ejemplo/espresso.webp', alt: 'Imagen editorial del espresso' } }).editorial.find((section) => section.name === 'detail').image;
if (detailFallback.src !== '/images/cafe-taza.webp' || detailFallback.alt !== 'Detalle de la crema de un espresso visto desde arriba' || detailFromCms.src !== 'https://a.storyblok.com/ejemplo/espresso.webp' || detailFromCms.alt !== 'Imagen editorial del espresso') {
  throw Error('El detalle debe usar la nueva taza local, salvo que Storyblok configure una imagen propia.');
}

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
    const start = film.getBoundingClientRect().top + window.scrollY;
    const max = film.getBoundingClientRect().height - window.innerHeight;
    window.scrollTo(0, Math.round(start + max * fraction));
  }, ratio);
  await page.waitForFunction((fraction) => {
    const video = document.querySelector('.coffee-film__video');
    const line = document.querySelector('.coffee-film__progress span');
    const actual = Number((line?.style.transform.match(/scaleX\(([^)]+)/) || [])[1]);
    const film = document.querySelector('.coffee-film');
    const start = film.getBoundingClientRect().top + scrollY;
    const distance = film.getBoundingClientRect().height - innerHeight;
    const position = Math.max(0, Math.min(1, (scrollY - start) / distance));
    return video && video.readyState >= 2 && !video.seeking && Number.isFinite(actual) && Math.abs(position - fraction) < .015 && Math.abs(video.currentTime / video.duration - actual) < .012;
  }, ratio, { timeout: 20000 });
  // El seeked/currentTime puede llegar antes que el fotograma nuevo al compositor de Chrome.
  await page.waitForTimeout(400);
  return page.locator('.coffee-film__video').evaluate((video) => ({ time: video.currentTime, duration: video.duration, paused: video.paused }));
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  desktop.on('pageerror', (error) => errors.push(`desktop: ${error.message}`));
  await desktop.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await desktop.waitForFunction(() => document.querySelector('.coffee-loop__video').currentTime > .15 && document.querySelector('.coffee-film').classList.contains('is-video-ready'), null, { timeout: 25000 });
  await capture(desktop, 'desktop-loop.png');
  const loopState = await desktop.evaluate(() => {
    const brand = document.querySelector('.coffee-header__brand').getBoundingClientRect();
    const navigation = document.querySelector('.coffee-header__nav').getBoundingClientRect();
    return { source: document.querySelector('.coffee-loop__video').getAttribute('src'), duration: document.querySelector('.coffee-loop__video').duration, paused: document.querySelector('.coffee-loop__video').paused, sections: document.querySelectorAll('.coffee-film').length, scrollOpacity: getComputedStyle(document.querySelector('.coffee-film__scroll')).opacity, controls: document.querySelectorAll('.coffee-film button, .coffee-film video[controls]').length, headings: document.querySelectorAll('.coffee-film h1').length, eyebrow: document.querySelector('.coffee-film__eyebrow')?.textContent?.trim(), title: document.querySelector('.coffee-film__intro h1')?.textContent?.trim(), subtitle: document.querySelector('.coffee-film__intro p')?.textContent?.trim(), hint: document.querySelector('.coffee-film__hint')?.textContent?.trim(), credit: document.querySelector('.coffee-film__credit')?.textContent?.trim(), subtitleOpacity: getComputedStyle(document.querySelector('.coffee-film__intro p')).opacity, extraText: document.querySelectorAll('.coffee-loop__copy, .coffee-loop__link').length, headerVisible: !document.querySelector('.coffee-header')?.inert, logoLoaded: document.querySelector('.coffee-header__brand img')?.naturalWidth > 0, logoWidth: brand.width, alignment: Math.abs((brand.top + brand.bottom - navigation.top - navigation.bottom) / 2), nav: [...document.querySelectorAll('.coffee-header__nav .coffee-header__link')].map((node) => node.textContent.trim()), aboutHref: document.querySelector('.coffee-header__nav a:last-child')?.getAttribute('href'), buy: document.querySelector('.coffee-header__nav .coffee-header__link--buy')?.getAttribute('href') || document.querySelector('.coffee-header__nav .coffee-header__link--buy')?.disabled };
  });
  if (!loopState.source || loopState.duration < 2.8 || loopState.duration > 3 || loopState.paused || loopState.sections !== 1 || loopState.scrollOpacity !== '0' || loopState.controls || loopState.headings !== 1 || loopState.eyebrow !== 'Una experiencia en movimiento' || loopState.title !== 'Del grano a tu taza' || loopState.subtitle !== 'Una experiencia que comienza con el origen del café.' || loopState.hint !== 'Deslizá para descubrir' || loopState.credit !== 'by 1810' || loopState.subtitleOpacity !== '1' || loopState.extraText || !loopState.headerVisible || !loopState.logoLoaded || loopState.logoWidth !== 112 || loopState.alignment > 1 || loopState.nav.join('|') !== 'Inicio|Comprar|Sobre nosotros' || loopState.aboutHref !== '#historia' || !loopState.buy) throw Error(`El escenario inicial no coincide con lo solicitado: ${JSON.stringify(loopState)}`);
  console.log('LOOP ' + JSON.stringify(loopState));
  const favicons = await desktop.evaluate(async () => Promise.all([...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].map(async (link) => {
    const response = await fetch(link.href);
    return { path: new URL(link.href).pathname, status: response.status, bytes: (await response.arrayBuffer()).byteLength };
  })));
  if (favicons.length !== 3 || !['/favicon-32.png', '/favicon.ico', '/apple-touch-icon.png'].every((path) => favicons.some((icon) => icon.path === path && icon.status === 200 && icon.bytes > 1000))) throw Error(`Los íconos Cabrales no se sirven correctamente: ${JSON.stringify(favicons)}`);
  console.log('FAVICON ' + JSON.stringify(favicons));
  const cycles = await desktop.evaluate(() => new Promise((resolve, reject) => {
    const video = document.querySelector('.coffee-loop__video');
    let previous = video.currentTime;
    let wraps = 0;
    let internalJoins = 0;
    const done = () => { clearTimeout(timeout); video.removeEventListener('timeupdate', onTime); };
    const onTime = () => {
      if (previous < video.duration / 2 && video.currentTime >= video.duration / 2) internalJoins += 1;
      if (video.currentTime < previous - .5) wraps += 1;
      previous = video.currentTime;
      if (wraps === 2) {
        done();
        resolve({ wraps, internalJoins, paused: video.paused, posterOpacity: getComputedStyle(document.querySelector('.coffee-loop__poster')).opacity });
      }
    };
    const timeout = setTimeout(() => { done(); reject(Error('El loop doble no completó dos vueltas.')); }, 9000);
    video.addEventListener('timeupdate', onTime);
  }));
  if (cycles.paused || cycles.internalJoins < 2 || cycles.posterOpacity !== '0') throw Error(`El loop doble se detuvo o no cruzó ambas uniones internas: ${JSON.stringify(cycles)}`);
  console.log('BUCLE ' + JSON.stringify(cycles));
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  await desktop.waitForFunction(() => document.querySelector('.coffee-loop__video').paused && getComputedStyle(document.querySelector('.coffee-loop__poster')).opacity === '1');
  await desktop.emulateMedia({ reducedMotion: 'no-preference' });
  await desktop.waitForFunction(() => !document.querySelector('.coffee-loop__video').paused);
  await desktop.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await desktop.waitForFunction(() => document.querySelector('.coffee-loop__video').paused);
  await desktop.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await desktop.waitForFunction(() => !document.querySelector('.coffee-loop__video').paused);
  await desktop.evaluate(() => window.scrollTo(0, 1));
  await desktop.waitForFunction(() => scrollY >= 1 && document.querySelector('.coffee-loop__video').paused && +getComputedStyle(document.querySelector('.coffee-film__scroll')).opacity > 0 && document.querySelector('.coffee-header').inert);
  await desktop.evaluate(() => window.scrollTo(0, 120));
  await desktop.waitForFunction(() => scrollY >= 120 && document.querySelector('.coffee-film__video').currentTime > .15);
  const transition = await desktop.evaluate(() => ({ scrollY, loopOpacity: +getComputedStyle(document.querySelector('.coffee-loop')).opacity, filmOpacity: +getComputedStyle(document.querySelector('.coffee-film__scroll')).opacity, heading: document.querySelector('.coffee-film__intro h1')?.textContent?.trim(), headingOpacity: +getComputedStyle(document.querySelector('.coffee-film__intro')).opacity, paused: document.querySelector('.coffee-loop__video').paused }));
  if (!transition.paused || transition.heading !== loopState.title || transition.headingOpacity !== 1 || transition.filmOpacity < .6 || transition.filmOpacity > .75) throw Error(`La transición inicial no responde al scroll: ${JSON.stringify(transition)}`);
  await capture(desktop, 'desktop-transition.png');
  console.log('TRANSICION ' + JSON.stringify(transition));
  await desktop.evaluate(() => window.scrollTo(0, 0));
  await desktop.waitForFunction(() => scrollY === 0 && !document.querySelector('.coffee-loop__video').paused);
  await desktop.evaluate(() => window.scrollTo(0, 180));
  await desktop.waitForFunction(() => scrollY >= 170 && getComputedStyle(document.querySelector('.coffee-film__scroll')).opacity === '1' && document.querySelector('.coffee-loop__video').paused);
  await capture(desktop, 'desktop-intro.png');
  const interfaceState = await desktop.evaluate(() => ({
    headerHidden: document.querySelector('.coffee-header').inert,
    sceneNumbers: document.querySelectorAll('.coffee-scene__number').length,
    credit: document.querySelector('.coffee-film__credit')?.textContent?.trim(),
    creditCase: getComputedStyle(document.querySelector('.coffee-film__credit')).textTransform,
    titleColor: getComputedStyle(document.querySelector('.coffee-film__intro h1')).color,
    subtitleColor: getComputedStyle(document.querySelector('.coffee-film__intro p')).color,
    subtitleOpacity: getComputedStyle(document.querySelector('.coffee-film__intro p')).opacity,
  }));
  if (!interfaceState.headerHidden || interfaceState.sceneNumbers || interfaceState.credit !== 'by 1810' || interfaceState.creditCase !== 'none' || interfaceState.titleColor !== 'rgb(245, 239, 227)' || interfaceState.subtitleColor !== 'rgb(245, 239, 227)' || interfaceState.subtitleOpacity !== '1') {
    throw Error(`El diseño del hero no coincide con lo solicitado: ${JSON.stringify(interfaceState)}`);
  }
  console.log('INTERFAZ ' + JSON.stringify(interfaceState));
  const first = await frameAt(desktop, 0);
  const macro = await frameAt(desktop, .43);
  await capture(desktop, 'desktop-macro.png');
  const end = await frameAt(desktop, 1);
  await capture(desktop, 'desktop-end.png');
  const reverse = await frameAt(desktop, .26);
  const reset = await frameAt(desktop, 0);
  await desktop.waitForFunction(() => !document.querySelector('.coffee-loop__video').paused && getComputedStyle(document.querySelector('.coffee-loop')).opacity === '1');

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
  await desktop.waitForFunction(({ y, time }) => Math.abs(scrollY - y) < 25 && Math.abs(document.querySelector('.coffee-film__video').currentTime - time) < .5, { y: beforeReloadY, time: nearEnd.time }, { timeout: 15000 });
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert);
  console.log('RESTORE ' + JSON.stringify({ before: { y: beforeReloadY, time: nearEnd.time }, after: await desktop.evaluate(() => ({ y: scrollY, time: document.querySelector('.coffee-film__video').currentTime })) }));
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-tagline').offsetTop + 100));
  await desktop.waitForTimeout(350);
  await capture(desktop, 'desktop-editorial.png');
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--opening').offsetTop + 150));
  await desktop.waitForTimeout(850);
  await capture(desktop, 'desktop-opening.png');
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--detail').offsetTop + 150));
  await desktop.waitForFunction(() => document.querySelector('.coffee-panel--detail img').naturalWidth === 1280);
  await desktop.waitForTimeout(850);
  const detailImage = await desktop.locator('.coffee-panel--detail img').evaluate((image) => ({ src: image.getAttribute('src'), alt: image.alt, width: image.naturalWidth, height: image.naturalHeight }));
  if (detailImage.src !== detailFallback.src || detailImage.alt !== detailFallback.alt || detailImage.width !== 1280 || detailImage.height !== 720) throw Error(`La imagen de «Cada detalle cuenta» no se actualizó: ${JSON.stringify(detailImage)}`);
  await capture(desktop, 'desktop-detail.png');
  console.log('DETALLE ' + JSON.stringify(detailImage));
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert);
  await desktop.evaluate(() => window.scrollBy(0, -100));
  await desktop.waitForFunction(() => !document.querySelector('.coffee-header').inert && document.querySelector('#historia').getBoundingClientRect().top < innerHeight);
  await capture(desktop, 'desktop-header-return.png');
  await desktop.evaluate(() => window.scrollBy(0, 100));
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert);
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('#historia').offsetTop - innerHeight - 100));
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert);
  await desktop.evaluate(() => window.scrollTo(0, 0));
  await desktop.waitForFunction(() => !document.querySelector('.coffee-header').inert);
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('#historia').offsetTop - 80));
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert);
  await desktop.evaluate(() => window.scrollBy(0, -50));
  await desktop.waitForTimeout(100);
  if (!(await desktop.locator('.coffee-header').evaluate((header) => header.inert))) throw Error('El header apareció con el último tramo del video todavía visible.');
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('#historia').offsetTop + 180));
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert && document.querySelector('.coffee-tagline').getBoundingClientRect().top < 0);
  await desktop.evaluate(() => window.scrollBy(0, -80));
  await desktop.waitForFunction(() => !document.querySelector('.coffee-header').inert && document.querySelector('.coffee-tagline').getBoundingClientRect().top < 0);
  await capture(desktop, 'desktop-tagline-header.png');
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('#historia').offsetTop - innerHeight - 100));
  await desktop.waitForFunction(() => document.querySelector('.coffee-header').inert);
  console.log('HEADER ' + JSON.stringify({ loop: 'visible', video: 'oculto', editorialDown: 'oculto', editorialUp: 'visible', returnToVideo: 'oculto', returnToLoop: 'visible' }));

  for (const width of [390, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    mobile.on('pageerror', (error) => errors.push(`${width}px: ${error.message}`));
    await mobile.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await mobile.waitForFunction(() => document.querySelector('.coffee-loop__video').currentTime > .1, null, { timeout: 25000 });
    await capture(mobile, `mobile-${width}-loop.png`);
    await mobile.locator('.coffee-header__mobile summary').click();
    const mobileNav = await mobile.evaluate(() => ({ open: document.querySelector('.coffee-header__mobile').open, links: [...document.querySelectorAll('.coffee-header__mobile .coffee-header__link')].map((node) => node.textContent.trim()) }));
    if (!mobileNav.open || mobileNav.links.join('|') !== 'Inicio|Comprar|Sobre nosotros') throw Error(`El menú móvil no muestra los tres destinos en ${width}px: ${JSON.stringify(mobileNav)}`);
    await mobile.locator('.coffee-header__mobile summary').click();
    if (width === 390) {
      await mobile.waitForFunction(() => {
        const loop = document.querySelector('.coffee-loop__video');
        return loop.currentTime > loop.duration / 2 + .05 && loop.currentTime < loop.duration - .2 && !loop.paused;
      }, null, { timeout: 6000 });
    }
    await frameAt(mobile, .05);
    await mobile.waitForFunction(() => document.querySelector('.coffee-header').inert);
    await mobile.waitForSelector('.coffee-film.is-video-ready', { timeout: 25000 });
    const sizes = await mobile.evaluate(() => {
      const hint = document.querySelector('.coffee-film__hint');
      const credit = document.querySelector('.coffee-film__credit');
      const a = hint.getBoundingClientRect();
      const b = credit.getBoundingClientRect();
      const brand = document.querySelector('.coffee-header__brand').getBoundingClientRect();
      const menu = document.querySelector('.coffee-header__mobile').getBoundingClientRect();
      return { viewport: innerWidth, page: document.documentElement.scrollWidth, film: document.querySelector('.coffee-film__stage').getBoundingClientRect().width, logoWidth: brand.width, headerAlignment: Math.abs((brand.top + brand.bottom - menu.top - menu.bottom) / 2), bottomCenterDifference: Math.abs((a.top + a.bottom - b.top - b.bottom) / 2), hintClipped: hint.scrollWidth > hint.clientWidth + 1 };
    });
    if (sizes.page > sizes.viewport + 1 || sizes.logoWidth !== 84 || sizes.headerAlignment > 1 || sizes.bottomCenterDifference > 2 || sizes.hintClipped) throw Error(`Texto inferior o header desalineado en ${width}px: ${JSON.stringify(sizes)}`);
    await capture(mobile, `mobile-${width}.png`);
    const halfway = await frameAt(mobile, .49);
    await frameAt(mobile, 1);
    await capture(mobile, `mobile-${width}-end.png`);
    await mobile.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--detail').offsetTop + 80));
    await mobile.waitForFunction(() => document.querySelector('.coffee-panel--detail img').naturalWidth === 1280);
    await mobile.waitForTimeout(850);
    await capture(mobile, `mobile-${width}-detail.png`);
    console.log('MOBILE ' + JSON.stringify({ width, ...sizes, halfway }));
    await mobile.close();
  }

  for (const { width, height } of [{ width: 320, height: 480 }, { width: 844, height: 390 }]) {
    const compact = await browser.newPage({ viewport: { width, height }, isMobile: true, ignoreHTTPSErrors: true });
    await compact.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await compact.evaluate(() => document.fonts.ready);
    const bounds = await compact.evaluate(() => {
      const hero = document.querySelector('.coffee-film__stage').getBoundingClientRect();
      const copy = document.querySelector('.coffee-film__intro').getBoundingClientRect();
      const hint = document.querySelector('.coffee-film__hint');
      const credit = document.querySelector('.coffee-film__credit');
      const a = hint.getBoundingClientRect();
      const b = credit.getBoundingClientRect();
      const logo = document.querySelector('.coffee-header__brand').getBoundingClientRect();
      const navigation = (document.querySelector('.coffee-header__mobile').getBoundingClientRect().width ? document.querySelector('.coffee-header__mobile') : document.querySelector('.coffee-header__nav')).getBoundingClientRect();
      return { heroBottom: hero.bottom, copyTop: copy.top, copyBottom: copy.bottom, headerBottom: Math.max(logo.bottom, navigation.bottom), headerAlignment: Math.abs((logo.top + logo.bottom - navigation.top - navigation.bottom) / 2), hintBottom: a.bottom, bottomCenterDifference: Math.abs((a.top + a.bottom - b.top - b.bottom) / 2), hintClipped: hint.scrollWidth > hint.clientWidth + 1, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    if (bounds.copyTop < bounds.headerBottom + 4 || bounds.headerAlignment > 1 || bounds.copyBottom > Math.min(bounds.heroBottom, height) - 16 || bounds.hintBottom > height - 16 || bounds.bottomCenterDifference > 2 || bounds.hintClipped || bounds.pageWidth > bounds.viewportWidth + 1) throw Error(`El hero se corta en ${width}×${height}: ${JSON.stringify(bounds)}`);
    await capture(compact, `compact-${width}x${height}-loop.png`);
    console.log('COMPACT ' + JSON.stringify({ width, height, ...bounds }));
    await compact.close();
  }

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  await reduced.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await reduced.waitForSelector('.coffee-film');
  const reducedState = await reduced.evaluate(() => ({ enhanced: document.querySelector('.coffee-film').classList.contains('is-enhanced'), videoSrc: document.querySelector('.coffee-film__video').getAttribute('src'), loopSrc: document.querySelector('.coffee-loop__video').getAttribute('src'), h1: document.querySelector('h1')?.textContent, editorial: !!document.querySelector('.coffee-panel') }));
  if (reducedState.enhanced || reducedState.videoSrc || reducedState.loopSrc || !reducedState.editorial) throw Error('La alternativa de movimiento reducido no estática falló.');
  console.log('REDUCED ' + JSON.stringify(reducedState));
  await reduced.close();

  const staticPage = await browser.newPage({ javaScriptEnabled: false, ignoreHTTPSErrors: true });
  const response = await staticPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const staticState = await staticPage.evaluate(() => ({ title: document.querySelector('h1')?.textContent, poster: document.querySelector('.coffee-film__poster')?.getAttribute('src'), loopPoster: document.querySelector('.coffee-loop__poster')?.getAttribute('src'), editorial: document.querySelectorAll('.coffee-panel').length, subtitleOpacity: getComputedStyle(document.querySelector('.coffee-film__intro p')).opacity, header: getComputedStyle(document.querySelector('.coffee-header')).visibility, nav: document.querySelector('.coffee-header__nav')?.textContent, videosHaveSrc: [...document.querySelectorAll('video')].some((video) => video.hasAttribute('src')) }));
  if (response.status() !== 200 || !staticState.poster || !staticState.loopPoster || !staticState.editorial || staticState.subtitleOpacity !== '1' || staticState.header !== 'visible' || !staticState.nav?.includes('Sobre nosotros') || staticState.videosHaveSrc) throw Error('La alternativa sin JavaScript falló.');
  if (await staticPage.locator('.coffee-film__intro h1').textContent() !== staticState.title) throw Error('El título no se ve sin JavaScript.');
  await staticPage.setViewportSize({ width: 320, height: 480 });
  await staticPage.locator('.coffee-header__mobile summary').click();
  if (!(await staticPage.locator('.coffee-header__mobile').evaluate((menu) => menu.open))) throw Error('El menú móvil no funciona sin JavaScript.');
  await staticPage.locator('.coffee-header__mobile a[href="#historia"]').click();
  await staticPage.waitForFunction(() => location.hash === '#historia');
  console.log('NO_JS ' + JSON.stringify(staticState));
  await staticPage.close();

  const savedData = await browser.newPage({ ignoreHTTPSErrors: true });
  await savedData.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
  await savedData.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await savedData.waitForSelector('.coffee-film');
  const savingState = await savedData.evaluate(() => ({ enhanced: document.querySelector('.coffee-film').classList.contains('is-enhanced'), videosHaveSrc: [...document.querySelectorAll('video')].some((video) => video.hasAttribute('src')) }));
  if (savingState.enhanced || savingState.videosHaveSrc) throw Error(`El ahorro de datos descargó un video: ${JSON.stringify(savingState)}`);
  console.log('SAVE_DATA ' + JSON.stringify(savingState));
  await savedData.close();

  const brokenLoop = await browser.newPage({ ignoreHTTPSErrors: true });
  await brokenLoop.route('**/videos/cafe-loop.mp4', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'No disponible' }));
  await brokenLoop.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await brokenLoop.waitForFunction(() => document.querySelector('.coffee-loop__video').error !== null);
  const loopFallback = await brokenLoop.evaluate(() => ({ posterOpacity: getComputedStyle(document.querySelector('.coffee-loop__poster')).opacity, title: document.querySelector('.coffee-film__intro h1')?.textContent, hint: document.querySelector('.coffee-film__hint')?.textContent, editorial: !!document.querySelector('.coffee-panel') }));
  if (loopFallback.posterOpacity !== '1' || !loopFallback.title || !loopFallback.hint || !loopFallback.editorial) throw Error(`El fallback del loop falló: ${JSON.stringify(loopFallback)}`);
  console.log('LOOP_ERROR ' + JSON.stringify(loopFallback));
  await brokenLoop.close();

  const broken = await browser.newPage({ ignoreHTTPSErrors: true });
  await broken.route('**/videos/cafe-recorrido.mp4', (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'No disponible' }));
  await broken.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await broken.waitForSelector('.coffee-film.is-video-error', { timeout: 15000 });
  const errorState = await broken.evaluate(() => ({ editorial: document.querySelectorAll('.coffee-panel').length, status: document.querySelector('.coffee-film__status').textContent, loopOpacity: getComputedStyle(document.querySelector('.coffee-loop')).opacity, filmHeight: document.querySelector('.coffee-film').getBoundingClientRect().height }));
  if (!errorState.editorial || !errorState.status.includes('no está disponible') || errorState.loopOpacity !== '1' || errorState.filmHeight > 1200) throw Error('El fallback para un video caído falló.');
  console.log('VIDEO_ERROR ' + JSON.stringify(errorState));
  await broken.close();

  if (errors.length) throw Error(errors.join('\n'));
  console.log('PASS — Capturas en reports/screenshots/');
} finally {
  await browser.close();
}
