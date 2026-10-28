/* ============================================================
   Present Deck Engine — shell controls + motion
   ============================================================
   Reads URL params:
     ?brand=teams|odsp  (default teams)
     ?mode=light|dark   (default light)
     ?shell=rehearsal|clean (default rehearsal)
     ?edit=0|false      (default true)
   Adds:
     - bottom controls, fullscreen present mode, font scale
     - slide navigator sidebar with thumbnails
     - duplicate / hide / delete / reorder
     - per-slide data-motion reveal lifecycle
   ============================================================ */

(function() {
  // Apply URL params to body BEFORE DOM init so CSS is correct on first paint
  const params = new URLSearchParams(location.search);
  const brand = params.get('brand') || document.body.dataset.brand || 'teams';
  const mode = params.get('mode') || document.body.dataset.mode || 'light';
  const shell = params.get('shell') || document.body.dataset.shell || 'rehearsal';
  const editParam = params.get('edit');
  const editSource = editParam == null ? document.body.dataset.edit : editParam;
  const edit = /^(0|false|no)$/i.test(editSource || '') ? 'false' : 'true';
  document.body.setAttribute('data-brand', brand);
  document.body.setAttribute('data-mode', mode);
  document.body.setAttribute('data-shell', shell);
  document.body.setAttribute('data-edit', edit);

  // Update brand badge text if present
  document.addEventListener('DOMContentLoaded', () => {
    const badge = document.querySelector('.brand-badge');
    if (badge) {
      badge.innerHTML = `<b>${brand.toUpperCase()}</b> · ${mode} · ${shell}`;
    }
    init();
  });

  function init() {
    const deck = document.querySelector('.deck');
    const stage = document.getElementById('stage') || document.body;
    let slides = Array.from(document.querySelectorAll('.slide'));
    let total = slides.length;
    if (total === 0) return;

    const motionPool = ['fade-blur', 'rise', 'drift-left', 'drift-right', 'zoom-in', 'zoom-out', 'depth'];
    slides.forEach((slide, idx) => {
      if (!slide.dataset.motion) slide.dataset.motion = motionPool[idx % motionPool.length];
      if (!slide.dataset.section) slide.dataset.section = `Slide ${idx + 1}`;
      slide.querySelectorAll('.reveal').forEach((item, revealIdx) => {
        const rawIndex = item.style.getPropertyValue('--i').trim();
        const index = rawIndex === '' ? revealIdx : Number.parseFloat(rawIndex);
        item.style.setProperty('--reveal-delay', `${0.16 + (Number.isFinite(index) ? index : revealIdx) * 0.09}s`);
      });
    });

    let current = 0;
    let transitioning = false;
    let thumbs = [];
    let dragFrom = -1;
    const editMode = document.body.dataset.edit === 'true';

    // ---- Shell counter ----
    const shellCounter = document.getElementById('counter');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const fontUp = document.getElementById('fontUp');
    const fontDown = document.getElementById('fontDown');
    const fontPct = document.getElementById('fontPct');
    const presentBtn = document.getElementById('presentBtn');
    const sidebar = document.getElementById('sidebar');
    const sbOverlay = document.getElementById('sbOverlay');
    const sbList = document.getElementById('sbList');
    const menuBtn = document.getElementById('menuBtn');
    const root = document.documentElement;

    function visibleSlides() {
      return slides.filter(slide => !slide.classList.contains('hide'));
    }

    function firstVisibleIndex() {
      const first = visibleSlides()[0];
      return first ? slides.indexOf(first) : 0;
    }

    function lastVisibleIndex() {
      const visible = visibleSlides();
      const last = visible[visible.length - 1];
      return last ? slides.indexOf(last) : slides.length - 1;
    }

    function visiblePosition(idx) {
      const visible = visibleSlides();
      return {
        visible,
        pos: Math.max(visible.indexOf(slides[idx]) + 1, 1),
      };
    }

    function updateChrome(idx) {
      const { visible, pos } = visiblePosition(idx);
      const label = `${String(pos).padStart(2, '0')} / ${String(visible.length).padStart(2, '0')}`;
      if (shellCounter) shellCounter.textContent = label;
      if (prevBtn) prevBtn.disabled = !hasNeighbor(-1);
      if (nextBtn) nextBtn.disabled = !hasNeighbor(1);
    }

    function applyControl(idx) {
      const control = slides[idx].dataset.control;
      if (control === 'dark') {
        root.style.setProperty('--control-fg', '#f7f7ff');
        root.style.setProperty('--control-border', 'rgba(247,247,255,0.38)');
        root.style.setProperty('--control-border-hover', 'rgba(247,247,255,0.72)');
        root.style.setProperty('--control-hover-bg', 'rgba(247,247,255,0.1)');
      } else if (control === 'light') {
        root.style.setProperty('--control-fg', 'var(--ink)');
        root.style.setProperty('--control-border', 'color-mix(in srgb, var(--ink) 28%, transparent)');
        root.style.setProperty('--control-border-hover', 'color-mix(in srgb, var(--ink) 58%, transparent)');
        root.style.setProperty('--control-hover-bg', 'color-mix(in srgb, var(--ink) 6%, transparent)');
      } else {
        root.style.removeProperty('--control-fg');
        root.style.removeProperty('--control-border');
        root.style.removeProperty('--control-border-hover');
        root.style.removeProperty('--control-hover-bg');
      }
    }

    function setActive(idx) {
      slides.forEach((slide, i) => {
        const active = i === idx;
        slide.classList.toggle('is-active', active);
        slide.classList.toggle('active', active);
      });
    }

    function goTo(target, force = false) {
      if (transitioning) return;
      target = Math.max(0, Math.min(slides.length - 1, target));
      if (slides[target].classList.contains('hide')) {
        const fallback = visibleSlides()[0];
        if (!fallback) return;
        target = slides.indexOf(fallback);
      }
      if (target === current && !force) return;
      transitioning = true;
      setActive(target);
      updateChrome(target);
      applyControl(target);
      current = target;
      syncThumbs();
      setTimeout(() => { transitioning = false; }, 650);
    }

    // ---- Agenda click-to-navigate ----
    // Any <li data-target="<section-name>"> inside .agenda-list becomes
    // a clickable jump-link to the first slide whose data-section
    // contains that string. Lets the agenda double as a table of contents.
    document.querySelectorAll('.agenda-list li[data-target]').forEach(li => {
      li.addEventListener('click', () => {
        const target = li.dataset.target;
        if (!target) return;
        const idx = Array.from(slides).findIndex(s =>
          !s.classList.contains('hide') && (s.dataset.section || '').toLowerCase().includes(target.toLowerCase())
        );
        if (idx >= 0) goTo(idx);
      });
    });

    function hasNeighbor(direction) {
      for (let idx = current + direction; idx >= 0 && idx < slides.length; idx += direction) {
        if (!slides[idx].classList.contains('hide')) return true;
      }
      return false;
    }

    function step(direction) {
      for (let idx = current + direction; idx >= 0 && idx < slides.length; idx += direction) {
        if (!slides[idx].classList.contains('hide')) {
          goTo(idx);
          return;
        }
      }
    }

    // ---- Keyboard nav ----
    document.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault(); step(1); break;
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault(); step(-1); break;
        case 'Home':
          e.preventDefault(); goTo(firstVisibleIndex()); break;
        case 'End':
          e.preventDefault(); goTo(lastVisibleIndex()); break;
        case 'Escape':
          if (sidebar && sidebar.classList.contains('open')) {
            e.preventDefault();
            closeSidebar();
          } else if (isFullscreen()) {
            e.preventDefault();
            togglePresent();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault(); togglePresent(); break;
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', () => step(1));
    if (prevBtn) prevBtn.addEventListener('click', () => step(-1));

    function shouldIgnoreDeckGesture(event) {
      const target = event.target;
      if (!(target instanceof Element)) return false;
      return !!target.closest('iframe, input, textarea, select, [contenteditable="true"], [data-wheel-pass], [data-swipe-pass], [data-allow-scroll], .allow-scroll');
    }

    // ---- Wheel nav ----
    let wheelAcc = 0, wheelDecay = null;
    document.addEventListener('wheel', (e) => {
      if (sidebar && sidebar.classList.contains('open')) {
        if (e.target instanceof Node && sidebar.contains(e.target)) {
          wheelAcc = 0;
          clearTimeout(wheelDecay);
          return;
        }
        e.preventDefault();
        return;
      }
      if (shouldIgnoreDeckGesture(e)) return;
      e.preventDefault();
      wheelAcc += e.deltaY;
      if (wheelAcc > 120) { wheelAcc = 0; step(1); }
      else if (wheelAcc < -120) { wheelAcc = 0; step(-1); }
      clearTimeout(wheelDecay);
      wheelDecay = setTimeout(() => { wheelAcc = 0; }, 240);
    }, { passive: false });

    // ---- Touch swipe nav ----
    let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || shouldIgnoreDeckGesture(e)) return;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!touchStartTime || e.changedTouches.length !== 1 || shouldIgnoreDeckGesture(e)) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;
      touchStartTime = 0;
      if (elapsed > 800 || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      step(dx < 0 ? 1 : -1);
    }, { passive: true });

    // ---- Font scale ----
    let fontScale = 1;
    function setFontScale(value) {
      fontScale = Math.max(0.7, Math.min(1.35, value));
      root.style.setProperty('--font-scale', fontScale.toFixed(2));
      root.style.fontSize = `${fontScale * 100}%`;
      if (fontPct) fontPct.textContent = `${Math.round(fontScale * 100)}%`;
    }
    if (fontUp) fontUp.addEventListener('click', () => setFontScale(fontScale + 0.1));
    if (fontDown) fontDown.addEventListener('click', () => setFontScale(fontScale - 0.1));

    // ---- Present mode ----
    function isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function togglePresent() {
      if (!stage) return;
      if (isFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      } else {
        const enter = stage.requestFullscreen || stage.webkitRequestFullscreen;
        if (enter) enter.call(stage);
      }
    }
    function updatePresentButton() {
      if (!presentBtn) return;
      const active = isFullscreen();
      presentBtn.title = active ? 'Exit fullscreen (Esc)' : 'Fullscreen (F)';
      presentBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
      presentBtn.setAttribute('aria-pressed', String(active));
    }
    if (presentBtn) presentBtn.addEventListener('click', togglePresent);
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
      document.addEventListener(eventName, () => {
        stage.classList.toggle('is-presenting', isFullscreen());
        updatePresentButton();
      });
    });
    updatePresentButton();

    // ---- Thumbnail sidebar ----
    function slideTitle(slide, idx) {
      const title = slide.querySelector('.hero-title, .section-title-l1, .cta-question, .ty-title, h1, h2, h3');
      const text = title ? title.textContent.trim().replace(/\s+/g, ' ') : `Slide ${idx + 1}`;
      return text.length > 24 ? `${text.slice(0, 24)}...` : text;
    }

    function makeThumb(slide, idx) {
      const thumb = document.createElement('button');
      thumb.className = 'thumb';
      thumb.draggable = editMode;
      if (slide.classList.contains('hide')) thumb.classList.add('hide');

      const frame = document.createElement('div');
      frame.className = 'thumb-frame';
      const cloneDeck = document.createElement('div');
      cloneDeck.className = 'deck';
      const clone = slide.cloneNode(true);
      clone.classList.add('is-active', 'active');
      clone.style.opacity = '1';
      cloneDeck.appendChild(clone);
      frame.appendChild(cloneDeck);

      let tools;
      if (editMode) {
        tools = document.createElement('div');
        tools.className = 'thumb-tools';
        tools.innerHTML = `
          <button class="thumb-tool dup" title="Duplicate" aria-label="Duplicate slide" type="button"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8.5 8.5H6.25C5.2835 8.5 4.5 9.2835 4.5 10.25V17.75C4.5 18.7165 5.2835 19.5 6.25 19.5H11.25C12.1315 19.5 12.8591 18.8479 12.9805 18H14.4893C14.3616 19.6781 12.9608 21 11.25 21H6.25C4.45507 21 3 19.5449 3 17.75V10.25C3 8.45507 4.45507 7 6.25 7H8.5V8.5ZM17.75 3C19.5449 3 21 4.45507 21 6.25V13.75C21 15.5449 19.5449 17 17.75 17H12.75C10.9551 17 9.5 15.5449 9.5 13.75V6.25C9.5 4.45507 10.9551 3 12.75 3H17.75ZM12.75 4.5C11.7835 4.5 11 5.2835 11 6.25V13.75C11 14.7165 11.7835 15.5 12.75 15.5H17.75C18.7165 15.5 19.5 14.7165 19.5 13.75V6.25C19.5 5.2835 18.7165 4.5 17.75 4.5H12.75Z"/></svg></button>
          <button class="thumb-tool eye" title="Hide / show" aria-label="Hide or show slide" type="button"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M11.9999 9.00462C14.209 9.00462 15.9999 10.7955 15.9999 13.0046C15.9999 15.2138 14.209 17.0046 11.9999 17.0046C9.79073 17.0046 7.99987 15.2138 7.99987 13.0046C7.99987 10.7955 9.79073 9.00462 11.9999 9.00462ZM11.9999 10.5046C10.6192 10.5046 9.49987 11.6239 9.49987 13.0046C9.49987 14.3853 10.6192 15.5046 11.9999 15.5046C13.3806 15.5046 14.4999 14.3853 14.4999 13.0046C14.4999 11.6239 13.3806 10.5046 11.9999 10.5046ZM11.9999 5.5C16.6134 5.5 20.596 8.65001 21.701 13.0644C21.8016 13.4662 21.5574 13.8735 21.1556 13.9741C20.7537 14.0746 20.3465 13.8305 20.2459 13.4286C19.307 9.67796 15.9212 7 11.9999 7C8.07681 7 4.68997 9.68026 3.75273 13.4332C3.65237 13.835 3.24523 14.0794 2.84336 13.9791C2.44149 13.8787 2.19707 13.4716 2.29743 13.0697C3.40052 8.65272 7.38436 5.5 11.9999 5.5Z"/></svg></button>
          <button class="thumb-tool del" title="Delete" aria-label="Delete slide" type="button"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 5H14C14 3.89543 13.1046 3 12 3C10.8954 3 10 3.89543 10 5ZM8.5 5C8.5 3.067 10.067 1.5 12 1.5C13.933 1.5 15.5 3.067 15.5 5H21.25C21.6642 5 22 5.33579 22 5.75C22 6.16421 21.6642 6.5 21.25 6.5H19.9309L18.7589 18.6112C18.5729 20.5334 16.9575 22 15.0263 22H8.97369C7.04254 22 5.42715 20.5334 5.24113 18.6112L4.06908 6.5H2.75C2.33579 6.5 2 6.16421 2 5.75C2 5.33579 2.33579 5 2.75 5H8.5ZM10.5 9.75C10.5 9.33579 10.1642 9 9.75 9C9.33579 9 9 9.33579 9 9.75V17.25C9 17.6642 9.33579 18 9.75 18C10.1642 18 10.5 17.6642 10.5 17.25V9.75ZM14.25 9C14.6642 9 15 9.33579 15 9.75V17.25C15 17.6642 14.6642 18 14.25 18C13.8358 18 13.5 17.6642 13.5 17.25V9.75C13.5 9.33579 13.8358 9 14.25 9ZM6.73416 18.4667C6.84577 19.62 7.815 20.5 8.97369 20.5H15.0263C16.185 20.5 17.1542 19.62 17.2658 18.4667L18.4239 6.5H5.57608L6.73416 18.4667Z"/></svg></button>
        `;
        frame.appendChild(tools);
      }

      const caption = document.createElement('span');
      caption.className = 'thumb-cap';
      caption.textContent = `${String(idx + 1).padStart(2, '0')} · ${slideTitle(slide, idx)}`;
      thumb.append(frame, caption);

      if (tools) {
        tools.querySelector('.dup').addEventListener('click', event => { event.stopPropagation(); duplicateSlide(slide); });
        tools.querySelector('.eye').addEventListener('click', event => { event.stopPropagation(); toggleHide(slide); });
        tools.querySelector('.del').addEventListener('click', event => { event.stopPropagation(); deleteSlide(slide); });
      }
      thumb.addEventListener('click', () => { if (!thumb._dragging) goTo(slides.indexOf(slide)); });
      if (editMode) {
        thumb.addEventListener('dragstart', event => {
          thumb._dragging = true;
          dragFrom = slides.indexOf(slide);
          thumb.classList.add('dragging');
          event.dataTransfer.effectAllowed = 'move';
        });
        thumb.addEventListener('dragend', () => {
          thumb.classList.remove('dragging');
          setTimeout(() => { thumb._dragging = false; }, 0);
        });
        thumb.addEventListener('dragover', event => {
          event.preventDefault();
          thumbs.forEach(item => item.classList.remove('over'));
          if (slides.indexOf(slide) !== dragFrom) thumb.classList.add('over');
        });
        thumb.addEventListener('drop', event => {
          event.preventDefault();
          reorderSlide(dragFrom, slides.indexOf(slide));
        });
      }
      requestAnimationFrame(() => {
        const thumbDeck = frame.querySelector('.deck');
        if (thumbDeck) thumbDeck.style.transform = `scale(${frame.clientWidth / 1280})`;
      });
      return thumb;
    }

    function buildThumbs() {
      if (!sbList) return;
      sbList.innerHTML = '';
      thumbs = slides.map((slide, idx) => {
        const thumb = makeThumb(slide, idx);
        sbList.appendChild(thumb);
        return thumb;
      });
      syncThumbs();
    }

    function syncThumbs() {
      thumbs.forEach((thumb, idx) => thumb.classList.toggle('active', idx === current));
    }

    function refreshAfterMutation(targetSlide = slides[current]) {
      total = slides.length;
      buildThumbs();
      const targetIdx = Math.max(0, slides.indexOf(targetSlide));
      const visible = visibleSlides();
      transitioning = false;
      goTo(visible.includes(slides[targetIdx]) ? targetIdx : slides.indexOf(visible[0] || slides[0]), true);
      updateChrome(current);
    }

    function reorderSlide(from, to) {
      if (!deck || from < 0 || to < 0 || from === to) return;
      const currentSlide = slides[current];
      const [moved] = slides.splice(from, 1);
      slides.splice(to, 0, moved);
      deck.insertBefore(moved, slides[to + 1] || null);
      refreshAfterMutation(currentSlide);
    }

    function duplicateSlide(slide) {
      if (!deck) return;
      const idx = slides.indexOf(slide);
      const clone = slide.cloneNode(true);
      clone.classList.remove('is-active', 'active');
      slides.splice(idx + 1, 0, clone);
      deck.insertBefore(clone, slide.nextSibling);
      refreshAfterMutation(clone);
    }

    function deleteSlide(slide) {
      if (slides.length <= 1) return;
      const idx = slides.indexOf(slide);
      slides.splice(idx, 1);
      slide.remove();
      refreshAfterMutation(slides[Math.min(idx, slides.length - 1)]);
    }

    function toggleHide(slide) {
      slide.classList.toggle('hide');
      const visible = visibleSlides();
      if (visible.length === 0) slide.classList.remove('hide');
      refreshAfterMutation(slide.classList.contains('hide') ? visible[0] : slide);
    }

    function openSidebar() {
      if (!sidebar || !sbOverlay) return;
      sidebar.classList.add('open');
      sbOverlay.classList.add('open');
      syncThumbs();
    }
    function closeSidebar() {
      if (!sidebar || !sbOverlay) return;
      sidebar.classList.remove('open');
      sbOverlay.classList.remove('open');
    }
    if (menuBtn) menuBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
    if (sbOverlay) sbOverlay.addEventListener('click', closeSidebar);
    buildThumbs();

    slides.forEach(slide => slide.classList.remove('is-active', 'active'));
    updateChrome(0);
    applyControl(0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setActive(0);
      syncThumbs();
    }));

    window.__emmaDeck = {
      goTo,
      step,
      getCurrent: () => current,
      getTotal: () => visibleSlides().length,
      setFontScale,
    };
  }
})();
