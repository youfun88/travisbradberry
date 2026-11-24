// Admin dashboard for newsletter subscribers.
// Auth + reads go through Supabase. The publishable key is public. Security comes
// from Supabase Auth (Google sign-in) + a Row-Level Security policy that only lets
// the approved Google accounts below SELECT. The public site key can only INSERT.
// The ALLOWED list here only gives a friendly message; the database policy is the gate.
(function () {
  const SUPABASE_URL = 'https://eptdqgutovwymnmstrwt.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_qNaE7sOLfsH4k23oXcruCA_1GsGcztv';

  const ALLOWED = ['yufanchen@gmail.com', 'yufansapp@gmail.com', 'sleshtw@gmail.com'];

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---- elements ----
  const $ = (id) => document.getElementById(id);
  const loginView = $('login-view');
  const dashView = $('dash-view');
  const loginForm = $('login-form');
  const loginBtn = $('login-btn');
  const loginMsg = $('login-msg');
  const dashMsg = $('dash-msg');

  let allRows = [];        // every subscriber the admin can read
  let activePeriod = 'week';

  const PERIOD_LABELS = { week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };

  // ---- date helpers ----
  function periodStart(period) {
    const now = new Date();
    if (period === 'week') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - d.getDay()); // back to most recent Sunday, local midnight
      return d;
    }
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'year') return new Date(now.getFullYear(), 0, 1);
    return null; // all time
  }

  function rowsFor(period) {
    const start = periodStart(period);
    if (!start) return allRows;
    return allRows.filter((r) => new Date(r.created_at) >= start);
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ---- rendering ----
  function renderCounts() {
    $('num-week').textContent = rowsFor('week').length;
    $('num-month').textContent = rowsFor('month').length;
    $('num-year').textContent = rowsFor('year').length;
    $('num-all').textContent = allRows.length;
  }

  function renderTable() {
    const rows = rowsFor(activePeriod);
    const tbody = $('rows');
    tbody.innerHTML = '';
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      const email = document.createElement('td');
      email.className = 'email';
      email.textContent = r.email;
      const when = document.createElement('td');
      when.className = 'muted';
      when.textContent = fmtDate(r.created_at);
      const src = document.createElement('td');
      src.className = 'muted';
      src.textContent = r.source || '—';
      tr.append(email, when, src);
      tbody.appendChild(tr);
    });
    $('empty').hidden = rows.length > 0;
    $('list-heading').firstChild.textContent = PERIOD_LABELS[activePeriod] + ' ';
    $('list-count').textContent = '· ' + rows.length + (rows.length === 1 ? ' subscriber' : ' subscribers');

    document.querySelectorAll('.stat').forEach((b) => {
      b.classList.toggle('active', b.dataset.period === activePeriod);
    });
  }

  function setPeriod(period) {
    activePeriod = period;
    renderTable();
  }

  // ---- CSV ----
  function csvEscape(val) {
    const s = String(val == null ? '' : val);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function downloadCsv() {
    const rows = rowsFor(activePeriod);
    const header = ['email', 'subscribed_at', 'source'];
    const lines = [header.join(',')];
    rows.forEach((r) => {
      lines.push([csvEscape(r.email), csvEscape(r.created_at), csvEscape(r.source)].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `subscribers-${activePeriod}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---- data ----
  async function loadSubscribers() {
    dashMsg.textContent = 'Loading…';
    dashMsg.className = 'msg';
    const { data, error } = await sb
      .from('subscribers')
      .select('email, created_at, source')
      .order('created_at', { ascending: false });
    if (error) {
      dashMsg.textContent = 'Could not load subscribers: ' + error.message;
      dashMsg.className = 'msg err';
      return;
    }
    allRows = data || [];
    dashMsg.textContent = '';
    renderCounts();
    renderTable();
  }

  // ---- view switching ----
  function showDashboard(email) {
    loginView.hidden = true;
    dashView.hidden = false;
    $('who-email').textContent = email || '';
    setPeriod('week');
    loadSubscribers();
  }

  function showLogin() {
    shownFor = null;
    dashView.hidden = true;
    loginView.hidden = false;
    allRows = [];
  }

  // ---- auth ----
  loginBtn.addEventListener('click', async function () {
    loginBtn.disabled = true;
    loginMsg.textContent = 'Opening Google…';
    loginMsg.className = 'msg';
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      loginBtn.disabled = false;
      loginMsg.textContent = error.message || 'Sign-in failed.';
      loginMsg.className = 'msg err';
    }
  });

  // Signed in: approved accounts see the dashboard, anyone else is signed out again.
  let shownFor = null; // avoid loading twice when Supabase reports the same session again
  async function onSession(session) {
    if (!session) return showLogin();
    const email = ((session.user && session.user.email) || '').toLowerCase();
    if (email && email === shownFor) return;
    if (!ALLOWED.includes(email)) {
      await sb.auth.signOut();
      showLogin();
      loginMsg.textContent = (email || 'This account') + ' is not allowed to view subscribers.';
      loginMsg.className = 'msg err';
      return;
    }
    shownFor = email;
    showDashboard(email);
  }

  $('logout-btn').addEventListener('click', async function () {
    await sb.auth.signOut();
    showLogin();
  });

  $('csv-btn').addEventListener('click', downloadCsv);
  document.querySelectorAll('.stat').forEach((b) => {
    b.addEventListener('click', () => setPeriod(b.dataset.period));
  });

  // ---- restore session on load (also finishes the Google redirect) ----
  (async function init() {
    const { data } = await sb.auth.getSession();
    await onSession(data && data.session);
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN') onSession(session);
      if (event === 'SIGNED_OUT') showLogin();
    });
  })();
})();
