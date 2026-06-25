// Admin dashboard for newsletter subscribers.
// Auth + reads go through Supabase. The publishable key is public — security
// comes from Supabase Auth (login required) + a Row-Level Security policy that
// only lets authenticated users SELECT. The public site key can only INSERT.
(function () {
  const SUPABASE_URL = 'https://eptdqgutovwymnmstrwt.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_qNaE7sOLfsH4k23oXcruCA_1GsGcztv';

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
    dashView.hidden = true;
    loginView.hidden = false;
    allRows = [];
  }

  // ---- auth ----
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    if (!email || !password) {
      loginMsg.textContent = 'Enter your email and password.';
      loginMsg.className = 'msg err';
      return;
    }
    loginBtn.disabled = true;
    loginMsg.textContent = 'Signing in…';
    loginMsg.className = 'msg';
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    loginBtn.disabled = false;
    if (error) {
      loginMsg.textContent = error.message || 'Sign-in failed.';
      loginMsg.className = 'msg err';
      return;
    }
    loginForm.reset();
    loginMsg.textContent = '';
    showDashboard(data.user && data.user.email);
  });

  $('logout-btn').addEventListener('click', async function () {
    await sb.auth.signOut();
    showLogin();
  });

  $('csv-btn').addEventListener('click', downloadCsv);
  document.querySelectorAll('.stat').forEach((b) => {
    b.addEventListener('click', () => setPeriod(b.dataset.period));
  });

  // ---- restore session on load ----
  (async function init() {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      showDashboard(data.session.user && data.session.user.email);
    } else {
      showLogin();
    }
  })();
})();
