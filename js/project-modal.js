// Project detail popup: click a project card to see a looping set of
// screenshots and its description. Closes only via the × button or
// Escape — clicking inside the popup no longer closes it.
//
// The image strip auto-scrolls by default. Pressing the ‹ / › buttons,
// or clicking an image directly, pauses it and centers/"focuses" that
// image (neighbors shrink back slightly). ‹ / › then step one at a time;
// clicking a different image jumps straight to it. If left alone for a
// few seconds, it resumes auto-scrolling on its own.
//
// Adding real per-project screenshots: put the image file(s) in
// assets/, then add an entry to PROJECT_IMAGES below, keyed by the
// project's exact title (must match the <h3> text on its card), e.g.:
//   'Traffic Chaos': ['assets/traffic-1.jpg', 'assets/traffic-2.jpg'],
// Any number of images is fine — 1, 3, 10, whatever you have. A single
// image is shown statically (no point scrolling one photo against
// itself); 2+ auto-scroll, with speed scaled so more images doesn't
// mean a faster-feeling loop. Any project NOT listed here falls back
// to GENERIC_PLACEHOLDER.

const PROJECT_IMAGES = {
  // Add real screenshots here as you get them, e.g.:
  // 'Fishing Tycoon': ['assets/fishing-1.jpg', 'assets/fishing-2.jpg'],
  'Game Development Workstation': ['assets/editor.png', 'assets/editor1.png', 'assets/editor2.png', 'assets/editor3.png',],
  'Lemon Knight': ['assets/lemon.png', 'assets/lemon1.png', 'assets/lemon2.png', 'assets/lemon3.png',],
  'Door End-of-Line (E.O.L.) Tester — Porsche Manufacturing Project': ['assets/porsche.png', 'assets/porsche1.png', 'assets/porsche2.png', 'assets/porsche3.png',],
  'Industrial IoT Monitoring Dashboard': ['assets/nodered.png', 'assets/nodered1.png', 'assets/nodered2.png', 'assets/nodered3.png',],
};

const GENERIC_PLACEHOLDER = ['assets/screenshot.jpg'];

// Guaranteed to always render (it's inline, not a file), so if a real
// path is ever wrong — typo, wrong extension, moved/deleted file —
// the visitor sees a clean themed placeholder instead of the
// browser's ugly broken-image icon.
const FALLBACK_IMAGE_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420">' +
  '<rect width="100%" height="100%" fill="#141414"/>' +
  '<rect x="1" y="1" width="598" height="418" fill="none" stroke="#3A3A38"/>' +
  '<text x="50%" y="50%" fill="#8F8F8C" font-family="monospace" font-size="20" ' +
  'text-anchor="middle" dominant-baseline="middle">No image available</text>' +
  '</svg>'
);

function getImagesForProject(title) {
  return PROJECT_IMAGES[title] || GENERIC_PLACEHOLDER;
}

// Creates one <img>, wired so a failed/missing file falls back to the
// themed placeholder above instead of a broken-image icon.
function createCarouselImage(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.onerror = function () {
    this.onerror = null; // prevent a loop if the fallback itself ever failed
    this.src = FALLBACK_IMAGE_SRC;
  };
  return img;
}

// Populates every project card's thumbnail with the same image data
// used in the popup. A card with 2+ images crossfades between them
// automatically; 1 image (including the generic fallback) just shows
// statically — nothing to rotate with only one photo.
const THUMB_ROTATE_MS = 4500;

function setupCardThumbnails() {
  document.querySelectorAll('.project-card').forEach((card) => {
    const thumb = card.querySelector('.project-thumb');
    const title = card.querySelector('h3')?.textContent.trim();
    if (!thumb || !title) return;

    const images = getImagesForProject(title);
    const fragment = document.createDocumentFragment();
    const imgEls = images.map((src, i) => {
      const img = createCarouselImage(src, `${title} — thumbnail`);
      img.classList.add('project-thumb-img');
      if (i === 0) img.classList.add('is-active');
      fragment.appendChild(img);
      return img;
    });
    thumb.prepend(fragment);

    if (imgEls.length <= 1) return; // nothing to rotate

    let index = 0;
    setInterval(() => {
      imgEls[index].classList.remove('is-active');
      index = (index + 1) % imgEls.length;
      imgEls[index].classList.add('is-active');
    }, THUMB_ROTATE_MS);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupCardThumbnails();

  const overlay = document.getElementById('projectModal');
  if (!overlay) return; // this page has no modal (not the Projects page)

  const track = document.getElementById('modalTrack');
  const viewport = document.querySelector('.modal-carousel-viewport');
  const navControls = document.querySelector('.modal-carousel-nav');
  const titleEl = document.getElementById('modalTitle');
  const descEl = document.getElementById('modalDesc');
  const closeBtn = document.getElementById('modalClose');
  const prevBtn = document.getElementById('modalPrev');
  const nextBtn = document.getElementById('modalNext');

  const IDLE_RESUME_MS = 5000;
  const BASE_MARQUEE_SECONDS = 20; // tuned for a 4-image set
  const BASE_IMAGE_COUNT = 4;

  let imageCount = 4; // recalculated per-project in openModalFor, since lists can vary in length
  let currentIndex = 0;
  let manual = false;
  let idleTimer = null;
  // The correct "auto-scrolling" animation CSS for whatever project is
  // currently open — reapplied by resumeAuto() so coming out of manual
  // mode restores the right speed instead of a hardcoded default.
  let marqueeAnimationCss = 'none';

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
    return Array.from(track.children).slice(0, imageCount);
  }

  function setActive(index) {
    Array.from(track.children).forEach((img, i) => {
      img.classList.toggle('is-active', i % imageCount === index);
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
    track.style.animation = marqueeAnimationCss;
    Array.from(track.children).forEach((img) => img.classList.remove('is-active'));
  }

  function scheduleIdleResume() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(resumeAuto, IDLE_RESUME_MS);
  }

  function step(direction) {
    if (imageCount <= 1) return;
    if (!manual) {
      enterManualModeNearest();
    } else {
      currentIndex = (currentIndex + direction + imageCount) % imageCount;
    }
    centerOn(currentIndex);
    scheduleIdleResume();
  }

  // Used by clicking an image directly: we already know exactly which
  // image was clicked, so just freeze (if needed) and center on it.
  function focusIndex(index) {
    if (imageCount <= 1) return;
    freezeTrack();
    centerOn(index);
    scheduleIdleResume();
  }

  function openModalFor(card) {
    const title = card.querySelector('h3')?.textContent.trim() || 'Project';
    // Cards can optionally include a hidden <p class="full-description">
    // with a longer write-up — shown here in the popup — while the
    // visible <p> on the card itself stays short. Falls back to the
    // short one for cards that don't have a separate full version.
    const shortDesc = card.querySelector('p')?.textContent.trim() || '';
    const fullDesc = card.querySelector('.full-description')?.textContent.trim();
    const desc = fullDesc || shortDesc;

    titleEl.textContent = title;
    descEl.textContent = desc;

    // Reset to a clean state every time the modal opens.
    clearTimeout(idleTimer);
    manual = false;
    track.className = 'modal-carousel-track';
    track.style.cssText = '';
    track.innerHTML = '';

    const images = getImagesForProject(title);
    imageCount = images.length;

    if (imageCount <= 1) {
      // One photo: nothing to scroll or navigate between. Show it
      // static and centered, and hide the now-pointless ‹ / › buttons.
      marqueeAnimationCss = 'none';
      track.style.animation = 'none';
      track.style.justifyContent = 'center';
      track.appendChild(createCarouselImage(images[0] || GENERIC_PLACEHOLDER[0], `${title} — screenshot`));
      if (navControls) navControls.style.display = 'none';
    } else {
      // Scale the loop duration so the scroll SPEED (not the time)
      // stays consistent — a project with more images takes
      // proportionally longer to complete one full loop, instead of
      // flying by faster than a smaller set would.
      const seconds = BASE_MARQUEE_SECONDS * (imageCount / BASE_IMAGE_COUNT);
      marqueeAnimationCss = `modal-marquee ${seconds}s linear infinite`;
      track.style.animation = marqueeAnimationCss;
      if (navControls) navControls.style.display = '';
      // Duplicate the set once so the marquee loops seamlessly.
      [...images, ...images].forEach((src) => {
        track.appendChild(createCarouselImage(src, `${title} — screenshot`));
      });
    }

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
    focusIndex(rawIndex % imageCount);
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
});
