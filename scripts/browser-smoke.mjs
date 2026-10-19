import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { coffeeContent, creditText } from '../src/lib/coffeeContent.js';

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');
const originalVideo = readFileSync(resolve('media/originals/VideoFinal.mp4'));
const webVideo = readFileSync(resolve('public/videos/cafe-recorrido.mp4'));
if (sha256(originalVideo) !== '74087d310f5d26a22d5e2867bc5d6b76419ba2eec56d5173a4000bfb5f191ea3') {
  throw Error('El VideoFinal.mp4 original recibido no debe modificarse.');
}
if (webVideo.length >= originalVideo.length * .65 || webVideo.indexOf('ftyp') !== 4 || webVideo.indexOf('moov') < 0 || webVideo.indexOf('moov') > webVideo.indexOf('mdat') || sha256(webVideo) === sha256(originalVideo)) {
  throw Error('El scrub web debe ser una derivación más liviana, reproducible y con faststart del VideoFinal.mp4 intacto.');
}

const exampleBuy = coffeeContent({ cta_link: { url: 'https://example.com/tienda' } });
if (exampleBuy.buyHref !== 'https://example.com/tienda' || exampleBuy.cta !== null || coffeeContent({ cta_link: { url: 'javascript:alert(1)' } }).buyHref) {
  throw Error('El destino de Comprar debe respetar el enlace seguro de Storyblok incluso sin texto de CTA.');
}
if (coffeeContent().credit !== 'by 1810' || creditText() !== 'by 1810' || creditText({ credit_text: '   ' }) !== 'by 1810' || coffeeContent({ credit_text: '  Hecho por el estudio  ' }).credit !== 'Hecho por el estudio' || creditText({ credit_text: '  Hecho por el estudio  ' }) !== 'Hecho por el estudio') {
  throw Error('Los créditos del recorrido y del footer deben compartir el fallback y respetar el campo opcional de Storyblok.');
}
const detailFallback = coffeeContent().editorial.find((section) => section.name === 'detail').image;
const detailFromCms = coffeeContent({ detail_image: { filename: 'https://a.storyblok.com/ejemplo/granos.webp', alt: 'Macro editorial de granos' } }).editorial.find((section) => section.name === 'detail').image;
if (detailFallback.src !== '/images/cafe-grano-detalle.webp' || detailFallback.alt !== 'Primer plano de la textura de un grano de café tostado' || detailFromCms.src !== 'https://a.storyblok.com/ejemplo/granos.webp' || detailFromCms.alt !== 'Macro editorial de granos') {
  throw Error('El detalle debe usar el grano enfocado local, salvo que Storyblok configure una imagen propia.');
}
if (coffeeContent({ detail_title: 'Un detalle del editor' }).editorial.find((section) => section.name === 'detail').title !== 'Un detalle del editor') {
  throw Error('El título animado del detalle debe respetar el texto de Storyblok.');
}
const fallbackScenes = coffeeContent().scenes;
const closingScene = fallbackScenes.at(-1);
if (fallbackScenes.length !== 5 || fallbackScenes.some((scene) => !scene.highlight || !scene.headline.includes(scene.highlight)) || closingScene.headline !== 'El momento de disfrutar' || closingScene.subheadline !== 'La taza, el paquete y un instante para quedarse.' || closingScene.highlight !== 'disfrutar' || closingScene.placement !== 'above-cup' || fallbackScenes.slice(0, -1).some((scene) => scene.placement)) {
  throw Error('El cierre local debe tener una frase breve y una ubicación propia sobre la taza.');
}
const cmsScenes = coffeeContent({ scenes: [{ component: 'scene-item', headline: 'Titular del editor', subheadline: 'Texto del editor', start_progress: 72, end_progress: 100, text_position: 'left' }] }).scenes;
if (cmsScenes.length !== 1 || cmsScenes[0].headline !== 'Titular del editor' || cmsScenes[0].highlight || cmsScenes[0].placement) {
  throw Error('Las escenas de Storyblok no deben heredar énfasis ni posiciones del copy local.');
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
  return page.locator('.coffee-film__video').evaluate((video) => ({ time: video.currentTime, duration: video.duration, width: video.videoWidth, height: video.videoHeight, paused: video.paused }));
}

async function checkEnding(page, name) {
  const film = await frameAt(page, .88);
  const ending = await page.locator('.coffee-scene--above-cup').evaluate((scene) => {
    const box = scene.getBoundingClientRect();
    const word = scene.querySelector('strong');
    return { title: scene.querySelector('.coffee-scene__title').textContent, subtitle: scene.querySelector('.coffee-scene__subtitle').textContent, opacity: +getComputedStyle(scene).opacity, top: box.top, bottom: box.bottom, left: box.left, right: box.right, viewportWidth: innerWidth, viewportHeight: innerHeight, titleWeight: getComputedStyle(scene.querySelector('.coffee-scene__title')).fontWeight, word: word?.textContent, wordWeight: word && getComputedStyle(word).fontWeight };
  });
  if (!film.paused || film.time < 18 || film.time > 22 || ending.title !== closingScene.headline || ending.subtitle !== closingScene.subheadline || ending.opacity < .9 || ending.top < 15 || ending.bottom > ending.viewportHeight * .48 || ending.left < 15 || ending.right > ending.viewportWidth - 15 || ending.titleWeight !== '500' || ending.word !== 'disfrutar' || ending.wordWeight !== '700') {
    throw Error(`El texto final tapa la taza o pierde legibilidad en ${name}: ${JSON.stringify({ film, ending })}`);
  }
  await capture(page, name);
  console.log('CIERRE ' + JSON.stringify({ name, film, ending }));
}

async function checkFooter(page, name) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForFunction(() => document.querySelector('.site-footer__brand img')?.naturalWidth > 0 && document.querySelector('.site-footer__studio')?.naturalWidth > 0);
  await page.locator('.site-footer__brand img').evaluate((image) => image.decode());
  await page.locator('.site-footer__studio').evaluate((image) => image.decode());
  const footer = await page.locator('.site-footer').evaluate((node) => {
    const logo = node.querySelector('.site-footer__brand');
    const signature = node.querySelector('.site-footer__signature');
    const credit = node.querySelector('.site-footer__credit');
    const studio = node.querySelector('.site-footer__studio');
    const a = logo.getBoundingClientRect();
    const b = credit.getBoundingClientRect();
    const s = signature.getBoundingClientRect();
    const c = studio.getBoundingClientRect();
    // Cabrales concentra el dibujo al 69 % del alto del PNG; el bloque 1810, unos 3,5 px bajo su centro.
    return { text: node.textContent.trim(), elements: node.children.length, href: logo.getAttribute('href'), label: logo.getAttribute('aria-label'), image: logo.querySelector('img').getAttribute('src'), logoLoaded: logo.querySelector('img').naturalWidth === 1589, background: getComputedStyle(logo).backgroundColor, border: getComputedStyle(logo).borderTopWidth, logoX: a.left, logoRight: a.right, logoWidth: a.width, studioSrc: studio.getAttribute('src'), studioLoaded: studio.naturalWidth > 0, studioAlt: studio.alt, studioWidth: c.width, creditX: b.left, studioX: c.left, stacked: c.top > b.bottom, creditTextAlign: getComputedStyle(credit).textAlign, creditAlignment: Math.abs((b.left + b.right - c.left - c.right) / 2), visualAlignment: Math.abs(a.top + a.height * (682 / 989) - (s.top + s.height / 2 + 3.5)), pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
  if (footer.text !== 'by 1810' || footer.elements !== 2 || footer.href !== '#inicio' || footer.label !== 'Cabrales: volver al inicio' || footer.image !== '/images/cabrales-logo-blanco.png' || !footer.logoLoaded || footer.background !== 'rgba(0, 0, 0, 0)' || footer.border !== '0px' || footer.studioSrc !== '/images/1810-white-logo.svg' || !footer.studioLoaded || footer.studioAlt !== '' || !footer.stacked || footer.logoX < 15 || footer.logoRight >= Math.min(footer.creditX, footer.studioX) || footer.creditTextAlign !== 'right' || footer.creditAlignment > 1 || footer.visualAlignment > 2 || footer.pageWidth > footer.viewportWidth + 1 || footer.logoWidth !== (footer.viewportWidth <= 700 ? 112 : 160) || footer.studioWidth !== (footer.viewportWidth <= 700 ? 68 : 92)) {
    throw Error(`El footer no alinea el bloque «by 1810» y el nuevo logo con Cabrales en ${name}: ${JSON.stringify(footer)}`);
  }
  await capture(page, name);
  console.log('FOOTER ' + JSON.stringify({ name, ...footer }));
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  desktop.on('pageerror', (error) => errors.push(`desktop: ${error.message}`));
  await desktop.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await desktop.waitForFunction(() => document.querySelector('.coffee-loop__video').currentTime > .15 && document.querySelector('.coffee-film').classList.contains('is-video-ready'), null, { timeout: 25000 });
  await desktop.locator('.coffee-header__brand img').evaluate((image) => image.decode());
  await capture(desktop, 'desktop-loop.png');
  const loopState = await desktop.evaluate(() => {
    const brand = document.querySelector('.coffee-header__brand').getBoundingClientRect();
    const navigation = document.querySelector('.coffee-header__nav').getBoundingClientRect();
    // El centro visual del PNG blanco, ponderado por los píxeles visibles, está al 69 % de su alto.
    return { source: document.querySelector('.coffee-loop__video').getAttribute('src'), duration: document.querySelector('.coffee-loop__video').duration, paused: document.querySelector('.coffee-loop__video').paused, sections: document.querySelectorAll('.coffee-film').length, scrollOpacity: getComputedStyle(document.querySelector('.coffee-film__scroll')).opacity, controls: document.querySelectorAll('.coffee-film button, .coffee-film video[controls]').length, headings: document.querySelectorAll('.coffee-film h1').length, eyebrow: document.querySelector('.coffee-film__eyebrow')?.textContent?.trim(), title: document.querySelector('.coffee-film__intro h1')?.textContent?.trim(), subtitle: document.querySelector('.coffee-film__intro p')?.textContent?.trim(), hint: document.querySelector('.coffee-film__hint')?.textContent?.trim(), credit: document.querySelector('.coffee-film__credit')?.textContent?.trim(), subtitleOpacity: getComputedStyle(document.querySelector('.coffee-film__intro p')).opacity, extraText: document.querySelectorAll('.coffee-loop__copy, .coffee-loop__link').length, headerVisible: !document.querySelector('.coffee-header')?.inert, logoLoaded: document.querySelector('.coffee-header__brand img')?.naturalWidth > 0, logoWidth: brand.width, alignment: Math.abs(brand.top + brand.height * (682 / 989) - (navigation.top + navigation.bottom) / 2), nav: [...document.querySelectorAll('.coffee-header__nav .coffee-header__link')].map((node) => node.textContent.trim()), aboutHref: document.querySelector('.coffee-header__nav a:last-child')?.getAttribute('href'), buy: document.querySelector('.coffee-header__nav .coffee-header__link--buy')?.getAttribute('href') || document.querySelector('.coffee-header__nav .coffee-header__link--buy')?.disabled };
  });
  if (!loopState.source || loopState.duration < 2.8 || loopState.duration > 3 || loopState.paused || loopState.sections !== 1 || loopState.scrollOpacity !== '0' || loopState.controls || loopState.headings !== 1 || loopState.eyebrow !== 'Una experiencia en movimiento' || loopState.title !== 'Del grano a tu taza' || loopState.subtitle !== 'Una experiencia que comienza con el origen del café.' || loopState.hint !== 'Deslizá para descubrir' || loopState.credit !== 'by 1810' || loopState.subtitleOpacity !== '1' || loopState.extraText || !loopState.headerVisible || !loopState.logoLoaded || loopState.logoWidth !== 112 || loopState.alignment > 1 || loopState.nav.join('|') !== 'Inicio|Comprar|Sobre nosotros' || loopState.aboutHref !== '#historia' || !loopState.buy) throw Error(`El escenario inicial no coincide con lo solicitado: ${JSON.stringify(loopState)}`);
  const headerLogo = await desktop.locator('.coffee-header__brand').evaluate((logo) => ({ source: logo.querySelector('img').getAttribute('src'), naturalWidth: logo.querySelector('img').naturalWidth, background: getComputedStyle(logo).backgroundColor, border: getComputedStyle(logo).borderTopWidth, shadow: getComputedStyle(logo.querySelector('img')).filter }));
  if (headerLogo.source !== '/images/cabrales-logo-blanco.png' || headerLogo.naturalWidth !== 1589 || headerLogo.background !== 'rgba(0, 0, 0, 0)' || headerLogo.border !== '0px' || headerLogo.shadow === 'none') throw Error(`El header debe usar el logo blanco transparente sin placa: ${JSON.stringify(headerLogo)}`);
  console.log('LOOP ' + JSON.stringify(loopState));
  console.log('LOGO_HEADER ' + JSON.stringify(headerLogo));
  const media = await desktop.evaluate(() => ({ loopPoster: document.querySelector('.coffee-loop__poster').getAttribute('src'), scrollPoster: document.querySelector('.coffee-film__poster').getAttribute('src'), opening: document.querySelector('.coffee-panel--opening img').getAttribute('src'), detail: document.querySelector('.coffee-panel--detail img').getAttribute('src'), closing: document.querySelector('.coffee-panel--closing img').getAttribute('src') }));
  if (media.loopPoster !== '/images/cafe-loop-poster.webp' || media.scrollPoster !== '/images/cafe-poster.webp' || media.opening !== '/images/cafe-granos.webp' || media.detail !== '/images/cafe-grano-detalle.webp' || media.closing !== '/images/cafe-final.webp') throw Error(`Los fallbacks editoriales no coinciden con los videos nuevos: ${JSON.stringify(media)}`);
  console.log('MEDIOS ' + JSON.stringify(media));
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

  if (!(first.width === 1280 && first.height === 720 && first.duration === 23.375 && macro.time > 6 && macro.time < 8.5 && end.time > end.duration - .25 && reverse.time < macro.time && reset.time < .15)) {
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
  const tagline = await desktop.locator('[data-coffee-tagline]').evaluate((heading) => ({ label: heading.getAttribute('aria-label'), words: heading.querySelectorAll('[data-coffee-word]').length }));
  if (tagline.label !== 'Cada plano nos acerca al café. Cada pausa invita a mirar.' || tagline.words < 8) throw Error('La frase animada original debe permanecer en la sección editorial.');
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--opening').offsetTop + 150));
  await desktop.waitForTimeout(850);
  await capture(desktop, 'desktop-opening.png');
  const detailTitle = await desktop.locator('[data-coffee-detail-title]').evaluate((heading) => ({ label: heading.getAttribute('aria-label'), words: heading.querySelectorAll('[data-coffee-word]').length, text: heading.textContent.trim().replace(/\s+/g, ' ') }));
  if (detailTitle.label !== 'Cada detalle cuenta' || detailTitle.text !== detailTitle.label || detailTitle.words !== 3) throw Error(`El título del detalle perdió su texto accesible: ${JSON.stringify(detailTitle)}`);
  await desktop.evaluate(() => {
    const title = document.querySelector('[data-coffee-detail-title]');
    window.scrollTo(0, title.getBoundingClientRect().top + scrollY - innerHeight * .93);
  });
  await desktop.waitForFunction(() => document.querySelector('[data-coffee-detail-title]')?.classList.contains('is-animated') && getComputedStyle(document.querySelector('[data-coffee-detail-title] [data-coffee-word]')).color === 'rgba(245, 239, 227, 0.3)');
  await desktop.evaluate(() => {
    const title = document.querySelector('[data-coffee-detail-title]');
    window.scrollTo(0, title.getBoundingClientRect().top + scrollY - innerHeight * .60);
  });
  await desktop.waitForFunction(() => {
    const words = [...document.querySelectorAll('[data-coffee-detail-title] [data-coffee-word]')];
    const opacity = (word) => Number(getComputedStyle(word).color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/)?.[1] ?? 1);
    return opacity(words[0]) > .85 && opacity(words.at(-1)) < .4;
  });
  await capture(desktop, 'desktop-detail-wordpaint.png');
  await desktop.evaluate(() => {
    const title = document.querySelector('[data-coffee-detail-title]');
    window.scrollTo(0, title.getBoundingClientRect().top + scrollY - innerHeight * .25);
  });
  await desktop.waitForFunction(() => {
    const words = [...document.querySelectorAll('[data-coffee-detail-title] [data-coffee-word]')];
    return words.every((word) => ['rgb(245, 239, 227)', 'rgba(245, 239, 227, 1)'].includes(getComputedStyle(word).color));
  });
  await desktop.evaluate(() => {
    const title = document.querySelector('[data-coffee-detail-title]');
    window.scrollTo(0, title.getBoundingClientRect().top + scrollY - innerHeight * .93);
  });
  await desktop.waitForFunction(() => [...document.querySelectorAll('[data-coffee-detail-title] [data-coffee-word]')].every((word) => getComputedStyle(word).color === 'rgba(245, 239, 227, 0.3)'));
  console.log('PALABRAS ' + JSON.stringify({ tagline, detailTitle, down: 'iluminado', up: 'atenuado' }));
  await desktop.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--detail').offsetTop + 150));
  await desktop.waitForFunction(() => document.querySelector('.coffee-panel--detail img').naturalWidth === 1280);
  await desktop.waitForTimeout(850);
  const detailImage = await desktop.locator('.coffee-panel--detail img').evaluate((image) => ({ src: image.getAttribute('src'), alt: image.alt, width: image.naturalWidth, height: image.naturalHeight }));
  if (detailImage.src !== detailFallback.src || detailImage.alt !== detailFallback.alt || detailImage.width !== 1280 || detailImage.height !== 720) throw Error(`La imagen de «Cada detalle cuenta» no se actualizó: ${JSON.stringify(detailImage)}`);
  await capture(desktop, 'desktop-detail.png');
  console.log('DETALLE ' + JSON.stringify(detailImage));
  // El ensayo del encendido retrocede dentro del detalle; bajar de nuevo restablece la dirección del header.
  await desktop.evaluate(() => window.scrollBy(0, 80));
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
  await checkFooter(desktop, 'desktop-footer.png');

  for (const { width, height } of [{ width: 1366, height: 768 }, { width: 1280, height: 800 }]) {
    const laptop = await browser.newPage({ viewport: { width, height }, ignoreHTTPSErrors: true });
    laptop.on('pageerror', (error) => errors.push(`laptop ${width}×${height}: ${error.message}`));
    await laptop.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await laptop.waitForSelector('.coffee-film.is-video-ready', { timeout: 25000 });
    const introBounds = await laptop.locator('.coffee-film__intro').boundingBox();
    if (!introBounds || introBounds.x < 24 || introBounds.y < 90 || introBounds.y + introBounds.height > height - 100) throw Error(`El inicio se superpone al contenido en el portátil ${width}×${height}: ${JSON.stringify(introBounds)}`);
    await capture(laptop, `laptop-${width}x${height}-loop.png`);
    await checkEnding(laptop, `laptop-${width}x${height}-ending.png`);
    await checkFooter(laptop, `laptop-${width}x${height}-footer.png`);
    await laptop.close();
  }

  for (const width of [390, 320]) {
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
    mobile.on('pageerror', (error) => errors.push(`${width}px: ${error.message}`));
    await mobile.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await mobile.waitForFunction(() => document.querySelector('.coffee-loop__video').currentTime > .1, null, { timeout: 25000 });
    await mobile.locator('.coffee-header__brand img').evaluate((image) => image.decode());
    await capture(mobile, `mobile-${width}-loop.png`);
    const mobileLogo = await mobile.locator('.coffee-header__brand').evaluate((logo) => ({ source: logo.querySelector('img').getAttribute('src'), naturalWidth: logo.querySelector('img').naturalWidth, background: getComputedStyle(logo).backgroundColor, border: getComputedStyle(logo).borderTopWidth }));
    if (mobileLogo.source !== '/images/cabrales-logo-blanco.png' || mobileLogo.naturalWidth !== 1589 || mobileLogo.background !== 'rgba(0, 0, 0, 0)' || mobileLogo.border !== '0px') throw Error(`El header móvil no usa el logo blanco en ${width}px: ${JSON.stringify(mobileLogo)}`);
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
      return { viewport: innerWidth, page: document.documentElement.scrollWidth, film: document.querySelector('.coffee-film__stage').getBoundingClientRect().width, logoWidth: brand.width, headerAlignment: Math.abs(brand.top + brand.height * (682 / 989) - (menu.top + menu.bottom) / 2), bottomCenterDifference: Math.abs((a.top + a.bottom - b.top - b.bottom) / 2), hintClipped: hint.scrollWidth > hint.clientWidth + 1 };
    });
    if (sizes.page > sizes.viewport + 1 || sizes.logoWidth !== 84 || sizes.headerAlignment > 1 || sizes.bottomCenterDifference > 2 || sizes.hintClipped) throw Error(`Texto inferior o header desalineado en ${width}px: ${JSON.stringify(sizes)}`);
    await capture(mobile, `mobile-${width}.png`);
    const halfway = await frameAt(mobile, .49);
    await checkEnding(mobile, `mobile-${width}-ending.png`);
    await frameAt(mobile, 1);
    await capture(mobile, `mobile-${width}-end.png`);
    await mobile.evaluate(() => window.scrollTo(0, document.querySelector('.coffee-panel--detail').offsetTop + 80));
    await mobile.waitForFunction(() => document.querySelector('.coffee-panel--detail img').naturalWidth === 1280);
    await mobile.waitForTimeout(850);
    await capture(mobile, `mobile-${width}-detail.png`);
    const mobileDetail = await mobile.locator('[data-coffee-detail-title]').evaluate((heading) => ({ title: heading.getAttribute('aria-label'), clipped: heading.scrollWidth > heading.clientWidth + 1, words: heading.querySelectorAll('[data-coffee-word]').length }));
    if (mobileDetail.title !== 'Cada detalle cuenta' || mobileDetail.clipped || mobileDetail.words !== 3) throw Error(`El título animado del detalle se corta en ${width}px: ${JSON.stringify(mobileDetail)}`);
    await mobile.evaluate(() => {
      const title = document.querySelector('[data-coffee-detail-title]');
      window.scrollTo(0, title.getBoundingClientRect().top + scrollY - innerHeight * .60);
    });
    await mobile.waitForFunction(() => {
      const words = [...document.querySelectorAll('[data-coffee-detail-title] [data-coffee-word]')];
      const opacity = (word) => Number(getComputedStyle(word).color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/)?.[1] ?? 1);
      return opacity(words[0]) > .85 && opacity(words.at(-1)) < .4;
    });
    await capture(mobile, `mobile-${width}-detail-wordpaint.png`);
    await checkFooter(mobile, `mobile-${width}-footer.png`);
    if (width === 320) {
      const cmsCreditFit = await mobile.evaluate(() => {
        for (const credit of document.querySelectorAll('.coffee-film__credit, .site-footer__credit')) credit.textContent = 'Una colaboración creativa con el estudio de diseño 1810';
        const film = document.querySelector('.coffee-film__credit');
        const footer = document.querySelector('.site-footer__credit');
        return { pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, filmFits: film.scrollWidth <= film.clientWidth + 1, footerFits: footer.scrollWidth <= footer.clientWidth + 1 };
      });
      if (cmsCreditFit.pageWidth > cmsCreditFit.viewportWidth + 1 || !cmsCreditFit.filmFits || !cmsCreditFit.footerFits) throw Error(`Un crédito de Storyblok más largo desborda la pantalla móvil: ${JSON.stringify(cmsCreditFit)}`);
      console.log('CMS_CREDIT_FIT ' + JSON.stringify(cmsCreditFit));
    }
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
      return { heroBottom: hero.bottom, copyTop: copy.top, copyBottom: copy.bottom, headerBottom: Math.max(logo.bottom, navigation.bottom), headerAlignment: Math.abs(logo.top + logo.height * (682 / 989) - (navigation.top + navigation.bottom) / 2), hintBottom: a.bottom, bottomCenterDifference: Math.abs((a.top + a.bottom - b.top - b.bottom) / 2), hintClipped: hint.scrollWidth > hint.clientWidth + 1, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    if (bounds.copyTop < bounds.headerBottom + 4 || bounds.headerAlignment > 1 || bounds.copyBottom > Math.min(bounds.heroBottom, height) - 16 || bounds.hintBottom > height - 16 || bounds.bottomCenterDifference > 2 || bounds.hintClipped || bounds.pageWidth > bounds.viewportWidth + 1) throw Error(`El hero se corta en ${width}×${height}: ${JSON.stringify(bounds)}`);
    await capture(compact, `compact-${width}x${height}-loop.png`);
    await compact.waitForSelector('.coffee-film.is-video-ready', { timeout: 25000 });
    await checkEnding(compact, `compact-${width}x${height}-ending.png`);
    console.log('COMPACT ' + JSON.stringify({ width, height, ...bounds }));
    await compact.close();
  }

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ignoreHTTPSErrors: true });
  await reduced.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await reduced.waitForSelector('.coffee-film');
  const reducedState = await reduced.evaluate(() => ({ enhanced: document.querySelector('.coffee-film').classList.contains('is-enhanced'), videoSrc: document.querySelector('.coffee-film__video').getAttribute('src'), loopSrc: document.querySelector('.coffee-loop__video').getAttribute('src'), h1: document.querySelector('h1')?.textContent, editorial: !!document.querySelector('.coffee-panel'), detailAnimated: document.querySelector('[data-coffee-detail-title]').classList.contains('is-animated'), detailColors: [...document.querySelectorAll('[data-coffee-detail-title] [data-coffee-word]')].map((word) => getComputedStyle(word).color) }));
  if (reducedState.enhanced || reducedState.videoSrc || reducedState.loopSrc || !reducedState.editorial || reducedState.detailAnimated || reducedState.detailColors.length !== 3 || reducedState.detailColors.some((color) => color !== 'rgb(245, 239, 227)')) throw Error('La alternativa de movimiento reducido no estática falló.');
  console.log('REDUCED ' + JSON.stringify(reducedState));
  await reduced.close();

  const staticPage = await browser.newPage({ javaScriptEnabled: false, ignoreHTTPSErrors: true });
  const response = await staticPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const staticState = await staticPage.evaluate(() => ({ title: document.querySelector('h1')?.textContent, poster: document.querySelector('.coffee-film__poster')?.getAttribute('src'), loopPoster: document.querySelector('.coffee-loop__poster')?.getAttribute('src'), editorial: document.querySelectorAll('.coffee-panel').length, subtitleOpacity: getComputedStyle(document.querySelector('.coffee-film__intro p')).opacity, header: getComputedStyle(document.querySelector('.coffee-header')).visibility, headerLogo: document.querySelector('.coffee-header__brand img')?.getAttribute('src'), nav: document.querySelector('.coffee-header__nav')?.textContent, videosHaveSrc: [...document.querySelectorAll('video')].some((video) => video.hasAttribute('src')), detailTitle: document.querySelector('[data-coffee-detail-title]')?.getAttribute('aria-label'), detailColors: [...document.querySelectorAll('[data-coffee-detail-title] [data-coffee-word]')].map((word) => getComputedStyle(word).color), footer: document.querySelector('.site-footer')?.textContent.trim(), footerLogo: document.querySelector('.site-footer__brand')?.getAttribute('href'), studioLogo: document.querySelector('.site-footer__studio')?.getAttribute('src') }));
  if (response.status() !== 200 || !staticState.poster || !staticState.loopPoster || !staticState.editorial || staticState.subtitleOpacity !== '1' || staticState.header !== 'visible' || staticState.headerLogo !== '/images/cabrales-logo-blanco.png' || !staticState.nav?.includes('Sobre nosotros') || staticState.videosHaveSrc || staticState.detailTitle !== 'Cada detalle cuenta' || staticState.detailColors.length !== 3 || staticState.detailColors.some((color) => color !== 'rgb(245, 239, 227)') || staticState.footer !== 'by 1810' || staticState.footerLogo !== '#inicio' || staticState.studioLogo !== '/images/1810-white-logo.svg') throw Error('La alternativa sin JavaScript falló.');
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
