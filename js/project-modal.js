// Project detail popup: click a project card to see a looping set of
// (placeholder) screenshots and its description. Closes on any click
// inside the overlay, on the × button, or on Escape.
//
// The image strip auto-scrolls by default. Pressing the ‹ / › buttons
// pauses it, centers and "focuses" the current image (neighbors shrink
// back slightly), and lets you step through images one at a time. If
// left alone for a few seconds, it resumes auto-scrolling on its own.
//
// Swapping in real screenshots: replace makePlaceholderImage() below
// with a lookup that returns real file paths for each project instead
// of a generated canvas image, e.g. an object keyed by project title.

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('projectModal');
  if (!overlay) return; // this page has no modal (not the Projects page)

  const track = document.getElementById('modalTrack');
  const viewport = document.querySelector('.modal-carousel-viewport');
  const titleEl = document.getElementById('modalTitle');
  const descEl = document.getElementById('modalDesc');
  const closeBtn = document.getElementById('modalClose');
  const prevBtn = document.getElementById('modalPrev');
  const nextBtn = document.getElementById('modalNext');

  const IMAGE_COUNT = 4;
  const IDLE_RESUME_MS = 5000;

  const TONES = [
    ['#1a1a1a', '#3a3a3a'],
    ['#1c1c1c', '#3e3e3e'],
    ['#181818', '#363636'],
    ['#1e1e1e', '#404040'],
  ];

  let currentIndex = 0;
  let manual = false;
  let idleTimer = null;

  function makePlaceholderImage(title, index, tone) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, tone[0]);
    grad.addColorStop(1, tone[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(244,244,242,0.9)';
    ctx.font = '600 26px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(title.toUpperCase(), canvas.width / 2, canvas.height / 2 - 6);

    ctx.fillStyle = 'rgba(244,244,242,0.5)';
    ctx.font = '400 16px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(`FIG. 0${index} — PLACEHOLDER SCREENSHOT`, canvas.width / 2, canvas.height / 2 + 26);

    return canvas.toDataURL('image/png');
  }

  // Reads the track's current animated (or manually set) X offset,
  // whether it came from the CSS keyframe animation or an inline style.
  function getCurrentTranslateX(el) {
    const t = window.getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    if (t.startsWith('matrix3d')) {
      const p = t.slice(9, -1).split(',').map(Number);
      return p[12];
    }
    const p = t.slice(7, -1).split(',').map(Number);
    return p[4];
  }

  function uniqueImages() {
    return Array.from(track.children).slice(0, IMAGE_COUNT);
  }

  function setActive(index) {
    Array.from(track.children).forEach((img, i) => {
      img.classList.toggle('is-active', i % IMAGE_COUNT === index);
    });
  }

  // Slides the track (with a smooth transition) so the image at `index`
  // sits centered in the viewport.
  function centerOn(index) {
    const imgs = uniqueImages();
    const target = imgs[index];
    if (!target || !viewport) return;
    const viewportCenter = viewport.clientWidth / 2;
    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const tx = viewportCenter - targetCenter;
    track.style.transform = `translateX(${tx}px)`;
    setActive(index);
    currentIndex = index;
  }

  function enterManualMode() {
    if (manual) return;
    manual = true;

    // Freeze the track exactly where the auto-scroll animation currently
    // has it, so switching to manual control causes no visible jump.
    const tx = getCurrentTranslateX(track);
    track.style.animation = 'none';
    track.style.transition = 'none';
    track.style.transform = `translateX(${tx}px)`;
    track.classList.add('manual');
    // Force a reflow so the transition below re-enables cleanly.
    void track.offsetHeight;
    track.style.transition = 'transform .4s ease';

    // Figure out which image is currently nearest the viewport center,
    // so the first press feels like it's continuing from where it was,
    // not resetting to image 1.
    const viewportCenter = (viewport?.clientWidth || 0) / 2;
    let nearest = 0;
    let nearestDist = Infinity;
    uniqueImages().forEach((img, i) => {
      const center = tx + img.offsetLeft + img.offsetWidth / 2;
      const dist = Math.abs(center - viewportCenter);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    currentIndex = nearest;
    setActive(currentIndex);
  }

  function resumeAuto() {
    manual = false;
    track.classList.remove('manual');
    track.style.transition = '';
    track.style.transform = '';
    track.style.animation = '';
    Array.from(track.children).forEach((img) => img.classList.remove('is-active'));
  }

  function scheduleIdleResume() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(resumeAuto, IDLE_RESUME_MS);
  }

  function step(direction) {
    if (!manual) {
      enterManualMode();
    } else {
      currentIndex = (currentIndex + direction + IMAGE_COUNT) % IMAGE_COUNT;
    }
    centerOn(currentIndex);
    scheduleIdleResume();
  }

  function openModalFor(card) {
    const title = card.querySelector('h3')?.textContent.trim() || 'Project';
    const desc = card.querySelector('p')?.textContent.trim() || '';

    titleEl.textContent = title;
    descEl.textContent = desc;

    // Reset to a clean auto-scrolling state every time the modal opens.
    clearTimeout(idleTimer);
    manual = false;
    track.className = 'modal-carousel-track';
    track.style.cssText = '';

    track.innerHTML = '';
    const images = [1, 2, 3, 4].map((n) => makePlaceholderImage(title, n, TONES[n - 1]));
    // Duplicate the set once so the marquee loops seamlessly.
    [...images, ...images].forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${title} — placeholder screenshot`;
      track.appendChild(img);
    });

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    clearTimeout(idleTimer);
  }

  document.querySelectorAll('.project-card--clickable').forEach((card) => {
    card.addEventListener('click', () => openModalFor(card));
  });

  // Click anywhere in the overlay (backdrop or panel) closes it.
  overlay.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModal();
  });

  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    step(-1);
  });
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    step(1);
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
});
