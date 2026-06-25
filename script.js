// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Mobile menu ----------
(function () {
  const nav = document.getElementById('top');
  const toggle = nav && nav.querySelector('.nav-toggle');
  if (!nav || !toggle) return;

  function close() { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }

  toggle.addEventListener('click', function () {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // close when a link is tapped
  nav.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', close);
  });
  // close when tapping outside the nav
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target)) close();
  });
})();

// Reveal-on-scroll
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 0.07}s`;
  io.observe(el);
});

// ---------- Subscribe forms ----------
// No backend: each form writes the signup directly into a Supabase table via
// its PostgREST API. The anon key is public by design — a Row-Level Security
// policy on the `subscribers` table allows INSERT only (no reads from the
// browser), so the list stays private. Works for every .subscribe-form on the
// page (hero + footer CTA).
//
// SETUP: replace the two placeholders below with the values from your Supabase
// project (Settings → API). The anon key is safe to commit to a public repo.
(function () {
  const SUPABASE_URL = 'https://eptdqgutovwymnmstrwt.supabase.co';
  // Publishable (client-side) key — safe to expose; the table's RLS allows INSERT only.
  const SUPABASE_ANON_KEY = 'sb_publishable_qNaE7sOLfsH4k23oXcruCA_1GsGcztv';

  const ENDPOINT = SUPABASE_URL + '/rest/v1/subscribers';

  function initForm(form) {
    const btn = form.querySelector('button[type="submit"]');
    const input = form.querySelector('input[type="email"]');
    const statusEl = form.querySelector('.form-status');
    const honey = form.querySelector('[name="_honey"]');

    function setStatus(msg, kind) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // honeypot — silently succeed for bots
      if (honey && honey.value) {
        setStatus('Thanks — you’re subscribed!', 'ok');
        return;
      }

      const email = (input ? input.value : '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('Please enter a valid email address.', 'err');
        return;
      }

      if (btn) btn.disabled = true;
      setStatus('Subscribing…', null);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          // don't echo the inserted row back — keeps the table read-protected
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email: email, source: location.pathname }),
      })
        .then(function (r) {
          // 201 = stored. 409 = duplicate (already on the list) — treat as success.
          if (r.status === 201 || r.status === 409) {
            form.reset();
            setStatus('Thanks — you’re subscribed!', 'ok');
            return;
          }
          throw new Error('bad status ' + r.status);
        })
        .catch(function () {
          setStatus('Something went wrong. Please try again later.', 'err');
        })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  }

  document.querySelectorAll('.subscribe-form').forEach(initForm);
})();
