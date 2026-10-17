import { useEffect, useRef } from 'react';
import SceneOverlay from './SceneOverlay.jsx';

// Los hitos se midieron sobre el MP4 original: frente 0-3,5; abertura/granos 3,5-6,8;
// macro 6,8-8,4; taza cenital 8,4-17; plano final 17-23,38 segundos.
// El macro recibe más recorrido físico para poder apreciarlo, sin frenar el video al detenerse.
const SOURCE_SECONDS = 23.375;
const SCROLL_MARKS = [[0, 0], [0.17, 3.5], [0.36, 6.8], [0.49, 8.4], [0.78, 17], [1, SOURCE_SECONDS]];

function filmTime(progress, duration) {
  for (let index = 1; index < SCROLL_MARKS.length; index += 1) {
    const [endScroll, endTime] = SCROLL_MARKS[index];
    if (progress <= endScroll) {
      const [startScroll, startTime] = SCROLL_MARKS[index - 1];
      const factor = Math.max(0, (progress - startScroll) / (endScroll - startScroll));
      return Math.min(duration - 0.042, ((startTime + (endTime - startTime) * factor) / SOURCE_SECONDS) * duration);
    }
  }
  return Math.max(0, duration - 0.042);
}

const clamp = (number) => Math.min(1, Math.max(0, number));
const fade = (value, start, end) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export default function ScrollVideo({ content }) {
  const sectionRef = useRef(null);
  const loopRef = useRef(null);
  const loopPosterRef = useRef(null);
  const loopLayerRef = useRef(null);
  const scrollLayerRef = useRef(null);
  const videoRef = useRef(null);
  const posterRef = useRef(null);
  const introRef = useRef(null);
  const progressRef = useRef(null);
  const statusRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    const loop = loopRef.current;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!section || !video || !loop || motionPreference.matches || navigator.connection?.saveData) return undefined;

    let alive = true;
    let trigger;
    let frame = 0;
    let duration = 0;
    let target = 0;
    let ready = false;
    let loopFailed = false;
    let ScrollTrigger;
    const sceneNodes = [...section.querySelectorAll('[data-coffee-scene]')];
    section.classList.add('is-enhanced');

    function currentProgress() {
      const start = section.getBoundingClientRect().top + window.scrollY;
      const distance = section.getBoundingClientRect().height - window.innerHeight;
      return distance > 0 ? clamp((window.scrollY - start) / distance) : 0;
    }

    function updateLoopPlayback(offset) {
      if (offset > 0 || document.hidden || loopFailed || motionPreference.matches) {
        loop.pause();
        if (motionPreference.matches && loopPosterRef.current) loopPosterRef.current.style.opacity = '1';
        return;
      }
      if (!loop.hasAttribute('src')) {
        loop.src = content.loopVideo;
        loop.load();
      }
      loop.play().catch(() => {
        // Un pause() al empezar a bajar puede abortar play(); se reintenta al volver arriba.
        if (loopPosterRef.current) loopPosterRef.current.style.opacity = '1';
      });
    }

    function updateLayers() {
      if (!alive) return;
      if (section.classList.contains('is-video-error')) {
        loopLayerRef.current.style.opacity = '1';
        scrollLayerRef.current.style.opacity = '0';
        updateLoopPlayback(0);
        return;
      }
      const start = section.getBoundingClientRect().top + window.scrollY;
      const offset = Math.max(0, window.scrollY - start);
      const blend = clamp(offset / Math.min(180, window.innerHeight * 0.25));
      loopLayerRef.current.style.opacity = String(1 - blend);
      scrollLayerRef.current.style.opacity = String(blend);
      scrollLayerRef.current.setAttribute('aria-hidden', blend >= 0.5 ? 'false' : 'true');
      updateLoopPlayback(offset);
    }

    function onLoopPlaying() {
      if (alive && !loopFailed && loopPosterRef.current) loopPosterRef.current.style.opacity = '0';
    }

    function onLoopError() {
      loopFailed = true;
      if (loopPosterRef.current) loopPosterRef.current.style.opacity = '1';
    }

    function updateText(time) {
      const percent = duration ? (time / duration) * 100 : 0;
      const introOpacity = 1 - fade(time, 1.3, 2.5);
      introRef.current.style.opacity = String(introOpacity);
      introRef.current.style.transform = `translate3d(0, ${Math.round((1 - introOpacity) * -16)}px, 0)`;
      sceneNodes.forEach((node, index) => {
        const scene = content.scenes[index];
        const first = index === 0 ? (fade(time, 1.5, 2.6)) : 1;
        const enter = fade(percent, scene.start, Math.min(scene.end, scene.start + 3));
        const exit = 1 - fade(percent, Math.max(scene.start, scene.end - 3), scene.end - 0.5);
        const opacity = clamp(Math.min(first, enter, exit));
        node.style.opacity = String(opacity);
        node.style.transform = `translate3d(0, ${Math.round((1 - opacity) * 24)}px, 0)`;
      });
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${clamp(duration ? time / duration : 0)})`;
    }

    function applyTarget() {
      frame = 0;
      if (!alive || !duration || video.seeking) return;
      if (Math.abs(video.currentTime - target) >= 0.034) {
        try { video.currentTime = target; } catch { /* Safari puede demorar la primera búsqueda. */ }
      } else if (video.readyState >= 2 && !ready) {
        showFilm();
      }
    }

    function showFilm() {
      if (!alive || ready || Math.abs(video.currentTime - target) > 0.12 || video.readyState < 2) return;
      ready = true;
      section.classList.add('is-video-ready');
      if (posterRef.current) posterRef.current.style.opacity = '0';
      if (statusRef.current) statusRef.current.textContent = '';
    }

    function scheduleTarget(time) {
      target = Math.max(0, time);
      updateText(target);
      if (!frame) frame = requestAnimationFrame(applyTarget);
    }

    function onMetadata() {
      duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (!duration) return;
      scheduleTarget(filmTime(trigger?.progress ?? currentProgress(), duration));
      ScrollTrigger?.refresh();
    }

    function onFrame() {
      showFilm();
      if (duration && Math.abs(video.currentTime - target) >= 0.034 && !frame) {
        frame = requestAnimationFrame(applyTarget);
      }
    }

    function onError() {
      section.classList.remove('is-enhanced', 'is-video-ready');
      section.classList.add('is-video-error');
      trigger?.kill();
      if (posterRef.current) posterRef.current.style.opacity = '1';
      loopLayerRef.current.style.opacity = '1';
      scrollLayerRef.current.style.opacity = '0';
      scrollLayerRef.current.setAttribute('aria-hidden', 'true');
      introRef.current.style.opacity = '1';
      introRef.current.style.transform = 'none';
      if (statusRef.current) statusRef.current.textContent = 'El video no está disponible. Podés seguir el recorrido en las imágenes de abajo.';
      updateLoopPlayback(0);
    }

    loop.addEventListener('playing', onLoopPlaying);
    loop.addEventListener('error', onLoopError);
    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('loadeddata', onFrame);
    video.addEventListener('seeked', onFrame);
    video.addEventListener('error', onError);
    video.src = content.video;
    video.load();
    updateLayers();

    function onEarlyScroll() {
      if (trigger || section.classList.contains('is-video-error')) return;
      updateLayers();
      if (duration) scheduleTarget(filmTime(currentProgress(), duration));
    }
    window.addEventListener('scroll', onEarlyScroll, { passive: true });

    function restoreScroll() {
      const position = window.__coffeeRestoreY;
      window.__coffeeRestoreY = null;
      if (!Number.isFinite(position) || position === null) return;
      const previous = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, position);
      document.documentElement.style.scrollBehavior = previous;
      ScrollTrigger?.refresh();
      if (duration) scheduleTarget(filmTime(trigger?.progress ?? 0, duration));
    }

    function onPageShow(event) {
      if (event.persisted) {
        ScrollTrigger?.refresh();
        updateLayers();
      }
    }
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', updateLayers);
    motionPreference.addEventListener('change', updateLayers);

    import('gsap/ScrollTrigger').then(async ({ ScrollTrigger: plugin }) => {
      const { gsap } = await import('gsap');
      if (!alive || section.classList.contains('is-video-error')) return;
      ScrollTrigger = plugin;
      gsap.registerPlugin(ScrollTrigger);
      trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        invalidateOnRefresh: true,
        onUpdate: (self) => { updateLayers(); if (duration) scheduleTarget(filmTime(self.progress, duration)); },
        onRefresh: (self) => { updateLayers(); if (duration) scheduleTarget(filmTime(self.progress, duration)); },
      });
      window.removeEventListener('scroll', onEarlyScroll);
      restoreScroll();
      updateLayers();
      if (duration) scheduleTarget(filmTime(trigger.progress, duration));
    }).catch(() => onError());

    return () => {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      trigger?.kill();
      loop.removeEventListener('playing', onLoopPlaying);
      loop.removeEventListener('error', onLoopError);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('loadeddata', onFrame);
      video.removeEventListener('seeked', onFrame);
      video.removeEventListener('error', onError);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', updateLayers);
      window.removeEventListener('scroll', onEarlyScroll);
      motionPreference.removeEventListener('change', updateLayers);
      loop.pause();
      loop.removeAttribute('src');
      loop.load();
      video.removeAttribute('src');
      video.load();
    };
  }, [content]);

  return (
    <section className="coffee-film" id="inicio" ref={sectionRef} aria-label="Recorrido cinematográfico del café">
      <div className="coffee-film__stage">
        <div className="coffee-loop" ref={loopLayerRef} aria-hidden="true">
          <div className="coffee-loop__media" aria-hidden="true">
            <img ref={loopPosterRef} className="coffee-loop__poster" src={content.loopPoster} alt="" fetchPriority="high" />
            <video ref={loopRef} className="coffee-loop__video" muted playsInline loop preload="none" poster={content.loopPoster} tabIndex={-1} disablePictureInPicture />
          </div>
        </div>
        <div className="coffee-film__scroll" ref={scrollLayerRef} aria-hidden="true">
          <div className="coffee-film__media" aria-hidden="true" style={{ '--focus-desktop': content.desktopPosition, '--focus-mobile': content.mobilePosition }}>
            <img ref={posterRef} className="coffee-film__poster" src={content.poster.src} alt="" />
            <video ref={videoRef} className="coffee-film__video" muted playsInline preload="none" poster={content.poster.src} tabIndex={-1} disablePictureInPicture aria-hidden="true" />
          </div>
          <div className="coffee-film__scrim" aria-hidden="true" />
          <SceneOverlay scenes={content.scenes} />
          <div className="coffee-film__progress" aria-hidden="true"><span ref={progressRef} /></div>
        </div>
        <div className="coffee-film__intro" ref={introRef}>
          <span className="coffee-film__eyebrow">Una experiencia en movimiento</span>
          <h1>{content.introTitle}</h1>
          <p>{content.introSubtitle}</p>
        </div>
        <div className="coffee-film__bottom">
          <span className="coffee-film__hint">{content.scrollHint}</span>
          <span className="coffee-film__credit">by 1810</span>
        </div>
        <p className="coffee-film__status" ref={statusRef} role="status" aria-live="polite" />
      </div>
    </section>
  );
}
