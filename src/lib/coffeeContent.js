// Los porcentajes corresponden al tiempo del video fuente (23,38 s), no a distancias arbitrarias de scroll.
export const DEFAULT_SCENES = [
  { headline: 'Super Cabrales Espresso', subheadline: 'Acá comienza el recorrido hacia tu taza.', highlight: 'Cabrales Espresso', start: 0, end: 15, position: 'left', theme: 'light' },
  { headline: 'Un mundo en su interior', subheadline: 'Cada grano guarda algo por descubrir.', highlight: 'interior', start: 15, end: 29, position: 'right', theme: 'light' },
  { headline: 'Cada grano, de cerca', subheadline: 'Texturas que invitan a detenerse un instante.', highlight: 'grano', start: 29, end: 36, position: 'right', theme: 'light' },
  { headline: 'Del grano al espresso', subheadline: 'El recorrido toma forma en la taza.', highlight: 'espresso', start: 36, end: 72, position: 'left', theme: 'light' },
  { headline: 'El momento de disfrutar', subheadline: 'La taza, el paquete y un instante para quedarse.', highlight: 'disfrutar', placement: 'above-cup', start: 72, end: 100, position: 'left', theme: 'light' },
];

export const DEFAULT_CREDIT = 'by 1810';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const fallbackText = (value, fallback) => text(value) || fallback;
export const creditText = (blok = {}) => fallbackText(blok.credit_text, DEFAULT_CREDIT);
const framing = (value) => {
  const position = text(value);
  return /^(?:\d{1,3}(?:\.\d+)?%|left|right|center|top|bottom)\s+(?:\d{1,3}(?:\.\d+)?%|left|right|center|top|bottom)$/.test(position)
    ? position : '50% 50%';
};

const safeUrl = (url) => {
  const value = text(url);
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
  } catch { /* El campo no tiene una URL utilizable. */ }
  return '';
};

function asset(value, fallback = '', fallbackAlt = '') {
  return {
    src: safeUrl(typeof value === 'string' ? value : value?.filename) || fallback,
    alt: text(value?.alt) || fallbackAlt,
  };
}

function link(value) {
  if (typeof value === 'string') return safeUrl(value);
  const url = text(value?.url) || text(value?.cached_url);
  // Los enlaces internos de Storyblok pueden no traer una barra inicial.
  if (value?.linktype === 'story' && url && !/^https?:\/\//i.test(url)) {
    return `/${url.replace(/^\/+/, '')}`;
  }
  return safeUrl(url);
}

function range(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : NaN;
}

function scenesFromCms(items) {
  if (!Array.isArray(items) || !items.length) return DEFAULT_SCENES;
  const scenes = items.filter((item) => item?.component === 'scene-item').map((item) => ({
    headline: text(item.headline),
    subheadline: text(item.subheadline),
    start: range(item.start_progress),
    end: range(item.end_progress),
    position: ['left', 'center', 'right'].includes(item.text_position) ? item.text_position : 'left',
    theme: item.text_theme === 'dark' ? 'dark' : 'light',
  })).filter((item) => item.headline && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start < item.end);

  // Si hay tres escenas publicadas, mostrar exactamente esas tres, sin completar con otras dos.
  return scenes.length ? scenes.sort((a, b) => a.start - b.start) : DEFAULT_SCENES;
}

export function coffeeContent(blok = {}) {
  const configuredPoster = asset(blok.scroll_poster_image).src ? blok.scroll_poster_image : blok.poster_image;
  const poster = asset(configuredPoster, '/images/cafe-poster.webp', 'Paquete de Super Cabrales Espresso sobre una mesa');
  const opening = asset(blok.opening_image, '/images/cafe-granos.webp', 'Primer plano de granos de café dentro del paquete');
  const detail = asset(blok.detail_image, '/images/cafe-grano-detalle.webp', 'Primer plano de la textura de un grano de café tostado');
  const closing = asset(blok.closing_image, '/images/cafe-final.webp', 'Una taza de espresso junto al paquete de café');
  const ctaLabel = text(blok.cta_text);
  const ctaHref = link(blok.cta_link);

  return {
    loopVideo: asset(blok.intro_video, '/videos/cafe-loop.mp4').src,
    loopPoster: '/images/cafe-loop-poster.webp',
    introTitle: fallbackText(blok.intro_title, 'Del grano a tu taza'),
    introSubtitle: fallbackText(blok.intro_subtitle, 'Una experiencia que comienza con el origen del café.'),
    scrollHint: fallbackText(blok.scroll_hint, 'Deslizá para descubrir'),
    credit: creditText(blok),
    video: asset(blok.scroll_video, '/videos/cafe-recorrido.mp4').src,
    poster,
    scenes: scenesFromCms(blok.scenes),
    desktopPosition: framing(blok.object_position_desktop),
    mobilePosition: framing(blok.object_position_mobile),
    buyHref: ctaHref,
    cta: ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : null,
    editorial: [
      { name: 'opening', eyebrow: '01 / El origen', title: fallbackText(blok.opening_title, 'Del grano a la experiencia'), text: '', image: opening },
      { name: 'detail', eyebrow: '02 / La mirada', title: fallbackText(blok.detail_title, 'Cada detalle cuenta'), text: fallbackText(blok.detail_text, 'Un acercamiento a las formas y texturas que atraviesan este recorrido.'), image: detail },
      { name: 'closing', eyebrow: '03 / El encuentro', title: fallbackText(blok.closing_title, 'El recorrido termina. La experiencia comienza.'), text: fallbackText(blok.closing_text, 'Una taza, el paquete y un último instante para volver a mirar.'), image: closing },
    ].filter((section) => section.image.src),
  };
}
