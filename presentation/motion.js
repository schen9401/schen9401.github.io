(() => {
  const scope = document.getElementById('deck') || document.querySelector('main');
  const videos = [...scope.querySelectorAll('video[data-motion-preview]')];
  if (!videos.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set();
  const userPaused = new WeakSet();
  const automaticPauses = new WeakSet();
  const sidebar = document.getElementById('sidebar');
  const toggles = [...scope.querySelectorAll('[data-motion-toggle]')];

  function updateToggles() {
    for (const button of toggles) {
      const playing = button.getAttribute('aria-controls').split(' ')
        .some((id) => !document.getElementById(id).paused);
      button.textContent = playing ? 'Pause animations' : 'Play animations';
    }
  }

  function pause(video) {
    if (video.paused) return;
    automaticPauses.add(video);
    video.pause();
  }

  function reportError(video, error) {
    const figure = video.closest('figure') || video.parentElement;
    if (figure.querySelector('.media-error')) return;
    const notice = document.createElement('p');
    notice.className = 'media-error';
    notice.setAttribute('role', 'status');
    notice.textContent = 'This animation could not load. The poster and description remain available.';
    figure.append(notice);
    console.error('Portfolio animation failed:', video.querySelector('source')?.getAttribute('src'), error);
  }

  function play(video) {
    video.play().catch((error) => {
      if (error.name === 'AbortError' && video.paused) return;
      if (error.name !== 'NotAllowedError') {
        reportError(video, error);
        return;
      }
      userPaused.add(video);
      const figure = video.closest('figure') || video.parentElement;
      if (!figure.querySelector('.motion-playback-notice')) {
        const notice = document.createElement('p');
        notice.className = 'motion-playback-notice';
        notice.setAttribute('role', 'status');
        notice.textContent = 'Automatic playback was blocked. Press Play to start the animation.';
        figure.append(notice);
      }
      console.warn('Automatic animation playback was blocked:', error);
    });
  }

  function sync() {
    for (const video of videos) {
      const slide = video.closest('.slide');
      const active = !slide || slide.classList.contains('is-active');
      if (document.hidden || !visible.has(video) || !active || sidebar?.classList.contains('open')) {
        pause(video);
      } else if (!reducedMotion.matches && !userPaused.has(video) && video.paused && !video.error) {
        play(video);
      }
    }
  }

  for (const video of videos) {
    video.muted = true;
    video.addEventListener('play', () => {
      userPaused.delete(video);
      updateToggles();
    });
    video.addEventListener('playing', () => {
      (video.closest('figure') || video.parentElement).querySelector('.motion-playback-notice')?.remove();
    });
    video.addEventListener('pause', () => {
      if (automaticPauses.has(video)) automaticPauses.delete(video);
      else userPaused.add(video);
      updateToggles();
    });
    video.addEventListener('error', () => reportError(video, video.error));
    for (const source of video.querySelectorAll('source')) {
      source.addEventListener('error', () => reportError(video, new Error('Media source failed to load')));
    }
  }

  for (const button of toggles) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const controlled = button.getAttribute('aria-controls').split(' ').map((id) => document.getElementById(id));
      if (controlled.some((video) => !video.paused)) {
        for (const video of controlled) {
          userPaused.add(video);
          pause(video);
        }
      } else {
        for (const video of controlled) {
          userPaused.delete(video);
          play(video);
        }
      }
      updateToggles();
    });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      sync();
    }, { threshold: [0, 0.15] });
    for (const video of videos) observer.observe(video);
  }
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) for (const video of videos) pause(video);
    else sync();
  });
  if (scope.id === 'deck') {
    new MutationObserver(sync).observe(scope, { attributes: true, subtree: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
  }
  updateToggles();
})();
