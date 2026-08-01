// Project detail popup: click a project card to see a looping set of
// (placeholder) screenshots and its description. Closes only via the ×
// button or Escape — clicking inside the popup no longer closes it.
//
// The image strip auto-scrolls by default. Pressing the ‹ / › buttons,
// or clicking an image directly, pauses it and centers/"focuses" that
// image (neighbors shrink back slightly). ‹ / › then step one at a time;
// clicking a different image jumps straight to it. If left alone for a
// few seconds, it resumes auto-scrolling on its own.
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

  // Freezes the track exactly where the auto-scroll animation currently
  // has it (no visible jump), and switches on manual control. Returns the
  // frozen X offset, or undefined if already in manual mode.
  function freezeTrack() {
    if (manual) return undefined;
    manual = true;

    const tx = getCurrentTranslateX(track);
    track.style.animation = 'none';
    track.style.transition = 'none';
    track.style.transform = `translateX(${tx}px)`;
    track.classList.add('manual');
    // Force a reflow so the transition below re-enables cleanly.
    void track.offsetHeight;
    track.style.transition = 'transform .4s ease';
    return tx;
  }

  // Used by the ‹ / › buttons: freeze the track, then figure out which
  // image is currently nearest the viewport center so the first press
  // feels like it's continuing from where it was, not resetting to image 1.
  function enterManualModeNearest() {
    const tx = freezeTrack();
    if (tx === undefined) return;
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
      enterManualModeNearest();
    } else {
      currentIndex = (currentIndex + direction + IMAGE_COUNT) % IMAGE_COUNT;
    }
    centerOn(currentIndex);
    scheduleIdleResume();
  }

  // Used by clicking an image directly: we already know exactly which
  // image was clicked, so just freeze (if needed) and center on it.
  function focusIndex(index) {
    freezeTrack();
    centerOn(index);
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

  // Closing is now deliberate only — the × button or Escape. Clicking
  // inside the popup (including the backdrop) no longer closes it, since
  // that was too easy to trigger by accident.
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

  // Clicking an image directly focuses it — same effect as pressing
  // ‹ / › but jumping straight to the one you clicked.
  track.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    const all = Array.from(track.children);
    const rawIndex = all.indexOf(img);
    if (rawIndex === -1) return;
    focusIndex(rawIndex % IMAGE_COUNT);
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
});
