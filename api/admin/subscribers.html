<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Subscriber Admin · The Artyst</title>
<style>
  :root {
    --ink: #1a1a1a;
    --ink-soft: #4a4a4a;
    --ink-faint: #6a6a6a;
    --paper: #fafaf8;
    --line: #e5e3dc;
    --accent: #1d5c5c;
    --accent-soft: #e8f2f1;
    --success: #2e7d5b;
    --success-soft: #e6f2ec;
    --warning: #a0712a;
    --warning-soft: #fbf0e0;
    --error: #b0433a;
    --error-soft: #fbe8e4;
  }
  * { box-sizing: border-box; }
  html { font-size: 16px; -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
    color: var(--ink);
    background: var(--paper);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    padding: 2rem 1.25rem;
  }
  main {
    max-width: 560px;
    width: 100%;
    margin: 0 auto;
  }
  header.page-head {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--line);
  }
  header.page-head .eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 0.35rem;
  }
  header.page-head h1 {
    font-family: "Charter", "Georgia", serif;
    font-size: 1.75rem;
    margin: 0;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  h2 {
    font-family: "Charter", "Georgia", serif;
    font-size: 1.25rem;
    margin: 0 0 1rem;
    font-weight: 700;
  }
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ink-soft);
    margin-bottom: 0.35rem;
  }
  input[type="text"], input[type="email"], input[type="password"] {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: 1rem;
    font-family: inherit;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: #ffffff;
    color: var(--ink);
    margin-bottom: 1.25rem;
    transition: border-color 0.15s;
  }
  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.75rem 1rem;
  }
  .radio-group label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-weight: 400;
    color: var(--ink);
    margin-bottom: 0;
    cursor: pointer;
    font-size: 0.9375rem;
  }
  .radio-group .hint {
    display: block;
    font-size: 0.8125rem;
    color: var(--ink-faint);
    margin-top: 0.15rem;
  }
  .checkbox {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-weight: 400;
    color: var(--ink);
    margin-bottom: 1.5rem;
    cursor: pointer;
    font-size: 0.875rem;
  }
  button {
    background: var(--accent);
    color: #ffffff;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    font-family: inherit;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  button:hover {
    background: #164848;
  }
  button:disabled {
    background: var(--ink-faint);
    cursor: not-allowed;
  }
  .result {
    margin-top: 1.5rem;
    padding: 1rem 1.25rem;
    border-radius: 4px;
    font-size: 0.9375rem;
    line-height: 1.5;
  }
  .result.success {
    background: var(--success-soft);
    border-left: 3px solid var(--success);
    color: #16432f;
  }
  .result.warning {
    background: var(--warning-soft);
    border-left: 3px solid var(--warning);
    color: #6a4a18;
  }
  .result.error {
    background: var(--error-soft);
    border-left: 3px solid var(--error);
    color: #6a2620;
  }
  .result strong { font-weight: 700; }
  .result .detail { margin-top: 0.5rem; font-size: 0.875rem; }
  .result .subscriber-meta {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(0,0,0,0.08);
    font-size: 0.8125rem;
    color: var(--ink-soft);
    font-family: "SF Mono", "Menlo", monospace;
  }
  .logout {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--line);
    font-size: 0.875rem;
    color: var(--ink-faint);
  }
  .logout a {
    color: var(--ink-faint);
    text-decoration: underline;
  }
  footer {
    margin-top: 3rem;
    font-size: 0.8125rem;
    color: var(--ink-faint);
  }
</style>
</head>
<body>
<main>
  <header class="page-head">
    <div class="eyebrow">The Artyst · Admin</div>
    <h1>Add subscriber</h1>
  </header>

  <!-- Auth prompt (shown when no password in session) -->
  <section id="auth-panel">
    <h2>Admin password</h2>
    <form id="auth-form" onsubmit="event.preventDefault(); authenticate();">
      <input type="password" id="password-input" placeholder="Enter admin password" autofocus required>
      <button type="submit">Unlock</button>
    </form>
    <div id="auth-error" class="result error" hidden></div>
  </section>

  <!-- Main admin form (shown after unlock) -->
  <section id="admin-panel" hidden>
    <form id="add-form" onsubmit="event.preventDefault(); addSubscriber();">
      <label for="email-input">Email</label>
      <input type="email" id="email-input" placeholder="name@example.com" autocomplete="off" required>

      <label for="name-input">First name (optional)</label>
      <input type="text" id="name-input" placeholder="Jane" autocomplete="off">

      <label>Mode</label>
      <div class="radio-group">
        <label>
          <input type="radio" name="mode" value="opt_in" checked>
          <div>
            Send opt-in email
            <span class="hint">They'll receive a welcome email with a confirm button. Won't go live until they click.</span>
          </div>
        </label>
        <label>
          <input type="radio" name="mode" value="confirmed">
          <div>
            Add as confirmed
            <span class="hint">They've already consented (verbal, in-venue, or explicit request). Goes live immediately. No email sent.</span>
          </div>
        </label>
      </div>

      <label class="checkbox">
        <input type="checkbox" id="force-checkbox">
        <span>Override previous unsubscribe or bounce (only tick if you're sure)</span>
      </label>

      <button type="submit" id="submit-btn">Submit</button>
    </form>

    <div id="result" class="result" hidden></div>

    <p class="logout"><a href="#" onclick="event.preventDefault(); logout();">Lock admin</a></p>
  </section>

  <footer>
    Adds go directly to the Supabase <code>subscribers</code> table. All events audited in <code>subscription_events</code>.<br>
    Manual adds are tagged <code>source=manual_add</code> and <code>import_batch=manual_add</code> for later reporting.
  </footer>
</main>

<script>
  const API_ADD = '/api/admin/add-subscriber';
  const SESSION_KEY = 'artyst_admin_pw';

  function getPw() {
    return sessionStorage.getItem(SESSION_KEY);
  }

  function savePw(pw) {
    sessionStorage.setItem(SESSION_KEY, pw);
  }

  function clearPw() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function showAdmin() {
    document.getElementById('auth-panel').hidden = true;
    document.getElementById('admin-panel').hidden = false;
    document.getElementById('email-input').focus();
  }

  function showAuth() {
    document.getElementById('admin-panel').hidden = true;
    document.getElementById('auth-panel').hidden = false;
    document.getElementById('password-input').focus();
  }

  function authenticate() {
    const pw = document.getElementById('password-input').value.trim();
    if (!pw) return;
    savePw(pw);
    document.getElementById('auth-error').hidden = true;
    showAdmin();
  }

  function logout() {
    clearPw();
    document.getElementById('email-input').value = '';
    document.getElementById('name-input').value = '';
    document.getElementById('force-checkbox').checked = false;
    document.getElementById('result').hidden = true;
    showAuth();
  }

  async function addSubscriber() {
    const pw = getPw();
    if (!pw) return showAuth();

    const email = document.getElementById('email-input').value.trim().toLowerCase();
    const firstName = document.getElementById('name-input').value.trim();
    const mode = document.querySelector('input[name="mode"]:checked').value;
    const force = document.getElementById('force-checkbox').checked;

    const submitBtn = document.getElementById('submit-btn');
    const resultEl = document.getElementById('result');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Working…';
    resultEl.hidden = true;

    try {
      const response = await fetch(API_ADD, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-password': pw,
        },
        body: JSON.stringify({
          email,
          first_name: firstName || null,
          mode,
          force,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        clearPw();
        document.getElementById('auth-error').textContent = 'Wrong password. Try again.';
        document.getElementById('auth-error').hidden = false;
        showAuth();
        return;
      }

      if (response.status === 409) {
        // Conflict — previously unsubscribed/bounced
        resultEl.className = 'result warning';
        resultEl.innerHTML =
          '<strong>Conflict</strong>' +
          '<div class="detail">' + escapeHtml(data.message || 'Existing state conflicts with this action.') + '</div>' +
          '<div class="subscriber-meta">' +
            'Status: ' + escapeHtml(data.existing_status || '?') +
            (data.unsubscribed_at ? ' · Unsubscribed: ' + escapeHtml(data.unsubscribed_at) : '') +
            (data.bounced_at ? ' · Bounced: ' + escapeHtml(data.bounced_at) : '') +
          '</div>';
        resultEl.hidden = false;
        return;
      }

      if (!response.ok) {
        resultEl.className = 'result error';
        resultEl.innerHTML =
          '<strong>Error</strong>' +
          '<div class="detail">' + escapeHtml(data.error || 'Unknown error') +
          (data.detail ? ' — ' + escapeHtml(data.detail) : '') + '</div>';
        resultEl.hidden = false;
        return;
      }

      // Success
      const s = data.subscriber || {};
      let headline;
      let detail = '';
      let className = 'result success';

      switch (data.action) {
        case 'inserted_pending':
          headline = 'Opt-in email sent';
          detail = 'A welcome email with a confirm button has been sent to <strong>' + escapeHtml(s.email) + '</strong>. They won\'t be active on the list until they click.';
          if (!data.email_sent) {
            className = 'result warning';
            headline = 'Added as pending, but email failed';
            detail = 'The subscriber is in the list as pending_confirmation, but the welcome email didn\'t send. ' +
                     (data.email_error ? 'Error: ' + escapeHtml(data.email_error) : '');
          }
          break;
        case 'inserted_confirmed':
          headline = 'Added as confirmed';
          detail = '<strong>' + escapeHtml(s.email) + '</strong> is now active on the list. No email was sent.';
          break;
        case 'updated_pending':
          headline = 'Fresh opt-in email sent';
          detail = 'Existing row updated with new token. A welcome email has been sent to <strong>' + escapeHtml(s.email) + '</strong>.';
          if (!data.email_sent) {
            className = 'result warning';
            headline = 'Updated, but email failed';
            detail = 'Existing row set back to pending_confirmation with a fresh token, but the welcome email failed. ' +
                     (data.email_error ? 'Error: ' + escapeHtml(data.email_error) : '');
          }
          break;
        case 'promoted_to_confirmed':
          headline = 'Promoted to confirmed';
          detail = 'Previously pending — now active on the list. No email sent.';
          break;
        case 'already_confirmed':
          headline = 'Already on the list';
          className = 'result warning';
          detail = '<strong>' + escapeHtml(s.email) + '</strong> is already confirmed. No changes made.';
          break;
        default:
          headline = 'Done';
          detail = escapeHtml(JSON.stringify(data));
      }

      resultEl.className = className;
      resultEl.innerHTML =
        '<strong>' + headline + '</strong>' +
        '<div class="detail">' + detail + '</div>' +
        '<div class="subscriber-meta">' +
          'ID: ' + escapeHtml(s.id || '?') +
          ' · Status: ' + escapeHtml(s.status || '?') +
          (data.previous_status ? ' · Was: ' + escapeHtml(data.previous_status) : '') +
        '</div>';
      resultEl.hidden = false;

      // Clear the form on success (not on warnings)
      if (className === 'result success') {
        document.getElementById('email-input').value = '';
        document.getElementById('name-input').value = '';
        document.getElementById('force-checkbox').checked = false;
        document.getElementById('email-input').focus();
      }

    } catch (e) {
      resultEl.className = 'result error';
      resultEl.innerHTML =
        '<strong>Network error</strong>' +
        '<div class="detail">' + escapeHtml(e.message || 'Request failed') + '</div>';
      resultEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // On load: if we have a saved password, show admin panel directly
  if (getPw()) {
    showAdmin();
  } else {
    showAuth();
  }
</script>
</body>
</html>
