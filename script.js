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
// No backend: each form posts to FormSubmit (https://formsubmit.co), which
// relays the signup to the site owner's inbox. Works for every .subscribe-form
// on the page (hero + footer CTA). To hide the address from source too, swap
// the ENDPOINT for the random alias FormSubmit gives you after activation, e.g.
//   const ENDPOINT = 'https://formsubmit.co/ajax/abcdef123456';
(function () {
  const ENDPOINT = 'https://formsubmit.co/ajax/yufanchen@gmail.com';

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
        setStatus('Thank you for your message. It has been sent.', 'ok');
        return;
      }

      const email = (input ? input.value : '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('Please enter a valid email address.', 'err');
        return;
      }

      if (btn) btn.disabled = true;
      setStatus('Subscribing…', null);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email,
          _replyto: email,
          _subject: 'New newsletter subscriber — The New Emotional Intelligence',
          _template: 'table',
        }),
      })
        .then(function (r) { if (!r.ok) throw new Error('bad status ' + r.status); return r.json(); })
        .then(function () {
          form.reset();
          setStatus('Thank you for your message. It has been sent.', 'ok');
        })
        .catch(function () {
          setStatus('There was an error trying to send your message. Please try again later.', 'err');
        })
        .finally(function () { if (btn) btn.disabled = false; });
    });
  }

  document.querySelectorAll('.subscribe-form').forEach(initForm);
})();
