// ============================================================
// STUDY VERSION — SPA router
// ============================================================
// Reads the URL hash (#/, #/projects, #/skills, #/experience,
// #/contact), shows the
// matching <section class="view-panel" data-view="..."> in index.html,
// and tells the persistent three.js scene (hero-scene.js) to move its
// camera to that view's preset. The canvas/WebGL context is created
// once here and never torn down while browsing.
// ============================================================

const VALID_VIEWS = ['projects', 'skills', 'experience', 'contact']; // 'home' is the implicit default
const TITLES = {
  home: 'MUHAMMAD FARHAN — Game Developer',
  projects: 'Projects — MUHAMMAD FARHAN',
  skills: 'Skills — MUHAMMAD FARHAN',
  experience: 'Experience — MUHAMMAD FARHAN',
  contact: 'Contact — MUHAMMAD FARHAN',
};

function parseView() {
  const raw = location.hash.replace(/^#\/?/, '');
  return VALID_VIEWS.includes(raw) ? raw : 'home';
}

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Scroll reveal ----
const revealIO = prefersReducedMotion
  ? null
  : new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealIO.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

function observeRevealsIn(panel) {
  const els = panel.querySelectorAll('.reveal');
  if (prefersReducedMotion) {
    els.forEach((el) => el.classList.add('in'));
  } else {
    els.forEach((el) => {
      el.classList.remove('in'); // re-trigger the fade-in each visit
      revealIO.observe(el);
    });
  }
}

// ---- Mobile nav toggle ----
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });
}

// ---- View switching ----
const hudSceneLine = document.getElementById('hudSceneLine');
const axisGizmo = document.querySelector('.axis-gizmo');
let heroControls = null; // set once the three.js scene finishes loading

function applyView(view) {
  document.querySelectorAll('.view-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.view === view);
  });

  document.querySelectorAll('.nav-links a[data-nav]').forEach((a) => {
    if (a.dataset.nav === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  document.title = TITLES[view] || TITLES.home;

  if (hudSceneLine) {
    hudSceneLine.innerHTML = `SCENE: ${view}_view.glb<br>RENDERER: WebGL — three.js`;
  }

  // The orb is only draggable on Home (see CAMERA_PRESETS.interactive in
  // hero-scene.js) — hide the axis gizmo elsewhere so it doesn't imply
  // an interaction that isn't available on that view.
  if (axisGizmo) {
    axisGizmo.style.display = view === 'home' ? '' : 'none';
  }

  heroControls?.setView(view);

  const activePanel = document.querySelector('.view-panel.active');
  if (activePanel) observeRevealsIn(activePanel);

  navLinks?.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => applyView(parseView()));
applyView(parseView()); // initial view, before the 3D scene has necessarily loaded

// ---- Three.js scene: created once, persists for the whole session ----
const canvas = document.getElementById('viewport-canvas');
const sceneMask = document.getElementById('sceneLoadingMask');

function revealScene() {
  sceneMask?.classList.add('hidden');
}

function revealSceneWithFallbackNote() {
  const textEl = sceneMask?.querySelector('.scene-loading-text');
  if (textEl) textEl.textContent = '3D preview unavailable — check your connection';
  console.warn(
    'Hero scene failed to load (likely a blocked/unreachable CDN for three.js). ' +
    'Falling back without the 3D viewport.'
  );
  setTimeout(revealScene, 1200);
}

if (canvas) {
  let settled = false;
  const markSettled = (fn) => (...args) => {
    if (settled) return;
    settled = true;
    fn(...args);
  };

  import('./hero-scene.js')
    .then(({ default: initHero }) => {
      heroControls = initHero(canvas, prefersReducedMotion);
      // Catch the scene up to wherever the user already navigated to
      // while it was loading (e.g. they clicked Projects immediately).
      heroControls.setView(parseView());
      requestAnimationFrame(() => requestAnimationFrame(markSettled(revealScene)));
    })
    .catch(markSettled(revealSceneWithFallbackNote));

  setTimeout(markSettled(revealSceneWithFallbackNote), 8000);
} else {
  revealScene();
}

// ---- Contact form: no backend, no third-party sign-up — submitting
// just opens the visitor's own email app with everything pre-filled,
// addressed straight to you. Change CONTACT_EMAIL if this ever needs
// to point somewhere else. ----
const CONTACT_EMAIL = 'farhanevo32@gmail.com';
const contactForm = document.getElementById('contactForm');

// Always-visible fallback (in case the form's mailto attempt silently
// fails, e.g. no default email app registered on the visitor's device).
const contactEmailFallback = document.getElementById('contactEmailFallback');
if (contactEmailFallback) {
  contactEmailFallback.href = `mailto:${CONTACT_EMAIL}`;
  contactEmailFallback.textContent = CONTACT_EMAIL;
}

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const message = document.getElementById('message')?.value.trim() || '';
    const statusEl = document.getElementById('contactFormStatus');

    if (!message) {
      if (statusEl) statusEl.textContent = 'Write a message first — the email needs something to send.';
      return;
    }

    const subject = encodeURIComponent(`Portfolio contact from ${name || 'a visitor'}`);
    const bodyLines = [message, ''];
    if (name) bodyLines.push(`— ${name}`);
    if (email) bodyLines.push(`(${email})`);
    const body = encodeURIComponent(bodyLines.join('\n'));

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

    if (statusEl) {
      statusEl.textContent = 'Opening your email app with this message pre-filled…';
    }
  });
}
