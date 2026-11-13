document.addEventListener('DOMContentLoaded', () => {
  const deck = document.getElementById('deck');
  const sidebar = document.getElementById('sidebar');
  const menu = document.getElementById('menuBtn');
  const controls = document.querySelector('.stage-controls');
  const home = document.querySelector('.deck-home-link');
  const previous = document.getElementById('prev');
  const next = document.getElementById('next');
  const slides = [...deck.querySelectorAll(':scope > .slide')];
  const status = document.createElement('span');
  status.className = 'deck-status';
  status.id = 'deck-text-status';
  status.setAttribute('role', 'status');
  controls.append(status);
  const close = document.createElement('button');
  close.className = 'navigator-close';
  close.type = 'button';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close slide navigator');
  close.addEventListener('click', () => menu.click());
  sidebar.querySelector('.sidebar-head').append(close);
  sidebar.setAttribute('role', 'dialog');
  let sidebarWasOpen = false;

  function syncSlides() {
    // The shared runtime updates its controls before updating its current index.
    const visible = slides.filter((slide) => !slide.classList.contains('hide'));
    const activeIndex = visible.findIndex((slide) => slide.classList.contains('is-active'));
    previous.disabled = activeIndex <= 0;
    next.disabled = activeIndex < 0 || activeIndex === visible.length - 1;
    const activeSlide = visible[activeIndex];
    const scrollable = Boolean(activeSlide && activeSlide.scrollHeight > activeSlide.clientHeight + 1);
    deck.toggleAttribute('data-wheel-pass', scrollable);
    deck.toggleAttribute('data-swipe-pass', scrollable);
    const message = scrollable
      ? 'Scroll within this slide or focus it and use up and down arrows. Use left and right arrows to change slides.'
      : document.documentElement.hasAttribute('data-text-enlarged') ? 'Text enlarged.' : '';
    if (status.textContent !== message) status.textContent = message;
    for (const slide of slides) {
      const active = slide.classList.contains('is-active');
      if (!active && slide.contains(document.activeElement)) menu.focus();
      slide.inert = !active;
      slide.setAttribute('aria-hidden', String(!active));
      slide.tabIndex = active && scrollable ? 0 : -1;
      if (active && scrollable) slide.setAttribute('aria-describedby', status.id);
      else slide.removeAttribute('aria-describedby');
    }
    for (const [index, thumb] of sidebar.querySelectorAll('.thumb').entries()) {
      if (slides[index].classList.contains('is-active')) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    }
  }

  function syncSidebar() {
    const open = sidebar.classList.contains('open');
    sidebar.inert = !open;
    sidebar.setAttribute('aria-hidden', String(!open));
    if (open) sidebar.setAttribute('aria-modal', 'true');
    else sidebar.removeAttribute('aria-modal');
    deck.inert = open;
    controls.inert = open;
    if (home) home.inert = open;
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close slide navigator' : 'Open slide navigator');
    if (!sidebarWasOpen && open) sidebar.querySelector('.thumb.active').focus();
    if (sidebarWasOpen && !open) menu.focus();
    sidebarWasOpen = open;
  }

  for (const [index, thumb] of sidebar.querySelectorAll('.thumb').entries()) {
    const frame = thumb.querySelector('.thumb-frame');
    frame.inert = true;
    frame.setAttribute('aria-hidden', 'true');
    for (const clone of frame.querySelectorAll('[id], [aria-labelledby], [aria-describedby]')) {
      clone.removeAttribute('id');
      clone.removeAttribute('aria-labelledby');
      clone.removeAttribute('aria-describedby');
    }
    for (const link of frame.querySelectorAll('a')) link.removeAttribute('href');
    for (const video of frame.querySelectorAll('video')) {
      video.removeAttribute('controls');
      for (const source of video.querySelectorAll('source')) source.removeAttribute('src');
      video.load();
    }
    const title = slides[index].querySelector('h1, h2, h3').innerText.replace(/\s+/g, ' ');
    thumb.setAttribute('aria-label', `Slide ${index + 1}: ${title}`);
  }
  document.getElementById('fontDown').setAttribute('aria-label', 'Decrease text size');
  document.getElementById('fontUp').setAttribute('aria-label', 'Increase text size');
  document.getElementById('fontUp').title = 'Increase text size; overflowing slides can be scrolled';
  const fullscreen = document.getElementById('presentBtn');
  const labelFullscreen = () => fullscreen.setAttribute('aria-label', 'Fullscreen');
  labelFullscreen();
  for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(name, labelFullscreen);

  function syncTextSize() {
    const enlarged = Number(document.documentElement.style.getPropertyValue('--font-scale') || 1) > 1;
    document.documentElement.toggleAttribute('data-text-enlarged', enlarged);
    syncSlides();
  }

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof Element && event.target.closest('video')) {
      event.stopPropagation();
      return;
    }
    const slide = event.target instanceof Element ? event.target.closest('#deck > .slide') : null;
    if (slide && slide.scrollHeight > slide.clientHeight + 1 &&
        ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      event.stopPropagation();
      return;
    }
    if (sidebarWasOpen && event.key === 'Tab') {
      const buttons = [close, ...sidebar.querySelectorAll('.thumb:not(.hide)')];
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        buttons.at(-1).focus();
      } else if (!event.shiftKey && index === buttons.length - 1) {
        event.preventDefault();
        close.focus();
      }
    }
    if (sidebarWasOpen && event.key !== 'Escape') event.stopPropagation();
    else if (event.key === ' ' && event.target instanceof Element && event.target.closest('button, a')) event.stopPropagation();
  }, true);

  syncSlides();
  syncSidebar();
  syncTextSize();
  new MutationObserver(syncSlides).observe(deck, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class'],
  });
  new MutationObserver(syncSidebar).observe(sidebar, {
    attributes: true,
    attributeFilter: ['class'],
  });
  new MutationObserver(syncTextSize).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
  });
  deck.addEventListener('load', syncSlides, true);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(syncSlides);
    observer.observe(deck);
    for (const slide of slides) for (const child of slide.children) observer.observe(child);
  } else {
    window.addEventListener('resize', syncSlides);
  }
});
