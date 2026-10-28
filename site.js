const dialog = document.querySelector('.image-dialog');

if (dialog && typeof dialog.showModal === 'function') {
  const image = dialog.querySelector('.dialog-image');
  const caption = dialog.querySelector('.dialog-caption');
  let trigger = null;

  for (const link of document.querySelectorAll('[data-lightbox]')) {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = link;
      const sourceImage = link.querySelector('img');
      image.src = link.href;
      image.alt = sourceImage.alt;
      caption.textContent = link.closest('figure').querySelector('figcaption').textContent;
      dialog.showModal();
    });
  }

  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => trigger?.focus());
}

const sectionLinks = [...document.querySelectorAll('.case-contents nav a')];
if ('IntersectionObserver' in window && sectionLinks.length) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (!visible.length) return;
    for (const link of sectionLinks) {
      if (link.hash === `#${visible[0].target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-8% 0px -65% 0px' });
  for (const link of sectionLinks) observer.observe(document.querySelector(link.hash));
}
