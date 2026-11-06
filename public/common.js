// Shared code used by every page
const NAV = [
  ['index.html', 'Dashboard'], ['customers.html', 'Customers'], ['vehicles.html', 'Vehicles'],
  ['services.html', 'Services'], ['bookings.html', 'Bookings'], ['payments.html', 'Payments'],
  ['reports.html', 'Reports'], ['about.html', 'About']
];

(function buildLayout() {
  const page = location.pathname.split('/').pop() || 'index.html';
  const header = document.getElementById('header');
  if (header) {
    header.innerHTML = `<header class="topbar">
      <div class="brand">🔧 Madhu <small>Vehicle Service Management</small></div>
      <button class="menu-btn" id="menuBtn" aria-label="Menu">☰</button>
      <nav id="nav">${NAV.map(([href, t]) => `<a href="${href}" class="${href === page ? 'active' : ''}">${t}</a>`).join('')}</nav>
    </header>`;
    document.getElementById('menuBtn').onclick = () => document.getElementById('nav').classList.toggle('open');
  }
  const footer = document.getElementById('footer');
  if (footer) footer.innerHTML = `<footer>© ${new Date().getFullYear()} Madhu Vehicle Service Management System</footer>`;
  const t = document.createElement('div');
  t.id = 'toast';
  document.body.appendChild(t);
})();

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(v) {
  return '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function badge(status) {
  return `<span class="badge ${esc(String(status).toLowerCase().replace(/ /g, '-'))}">${esc(status)}</span>`;
}

let toastTimer;
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + (type || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3500);
}

async function api(url, method, body) {
  const res = await fetch(url, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// Builds the form + table for a page (customers, vehicles, services, bookings, payments)
async function initCrud(cfg) {
  const form = document.getElementById('crud-form');
  const fieldsDiv = document.getElementById('fields');
  const tbody = document.getElementById('rows');
  const search = document.getElementById('search');
  const formTitle = document.getElementById('form-title');
  const submitBtn = document.getElementById('submit-btn');
  const countEl = document.getElementById('count');
  let editId = null;
  let rows = [];

  const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // 1. Build the form fields
  fieldsDiv.innerHTML = cfg.fields.map((f) => {
    const req = f.required ? 'required' : '';
    const def = f.default === 'today' ? localToday() : (f.default || '');
    let input;
    if (f.type === 'select') {
      const opts = (f.options || []).map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return `<option value="${esc(v)}" ${v === def ? 'selected' : ''}>${esc(l)}</option>`;
      }).join('');
      input = `<select name="${f.name}" ${req}><option value="">-- Select --</option>${opts}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea name="${f.name}" rows="2" ${req}>${esc(def)}</textarea>`;
    } else {
      input = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(def)}" ${req} ${f.attrs || ''} placeholder="${esc(f.placeholder || '')}">`;
    }
    return `<div class="field"><label>${f.label}${f.required ? ' <span class="req">*</span>' : ''}</label>${input}</div>`;
  }).join('');

  // 2. Fill dropdowns that come from the database
  for (const f of cfg.fields) {
    if (!f.optionsFrom) continue;
    try {
      const list = await api(f.optionsFrom.url);
      const sel = form.elements[f.name];
      list.forEach((r) => {
        const o = document.createElement('option');
        o.value = r.id;
        o.textContent = f.optionsFrom.label(r);
        sel.appendChild(o);
      });
      if (!list.length) {
        sel.parentNode.insertAdjacentHTML('beforeend',
          `<small class="hint">No records yet. Please add one on the <a href="${f.optionsFrom.page}">${f.optionsFrom.pageName}</a> page first.</small>`);
      }
    } catch (err) { toast(err.message, 'error'); }
  }

  // 3. Table header
  document.getElementById('head').innerHTML =
    `<tr>${cfg.columns.map((c) => `<th>${c.label}</th>`).join('')}<th>Actions</th></tr>`;

  function draw() {
    const q = search.value.trim().toLowerCase();
    const list = rows.filter((r) => !q || Object.values(r).join(' ').toLowerCase().includes(q));
    countEl.textContent = list.length;
    tbody.innerHTML = list.length
      ? list.map((r) => `<tr>${cfg.columns.map((c) => `<td>${c.format ? c.format(r) : esc(r[c.key])}</td>`).join('')}
          <td class="actions"><button class="btn small" data-edit="${r.id}">Edit</button>
          <button class="btn small danger" data-del="${r.id}">Delete</button></td></tr>`).join('')
      : `<tr><td colspan="${cfg.columns.length + 1}" class="empty">No records found.</td></tr>`;
  }

  async function load() {
    try { rows = await api(cfg.endpoint); draw(); }
    catch (err) { toast(err.message, 'error'); }
  }

  function resetForm() {
    form.reset();
    editId = null;
    formTitle.textContent = 'Add New ' + cfg.single;
    submitBtn.textContent = 'Save';
  }

  // 4. Events
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    cfg.fields.forEach((f) => {
      let v = form.elements[f.name].value.trim();
      if (f.upper) v = v.toUpperCase();
      body[f.name] = v;
    });
    try {
      if (editId) await api(`${cfg.endpoint}/${editId}`, 'PUT', body);
      else await api(cfg.endpoint, 'POST', body);
      toast(cfg.single + (editId ? ' updated successfully' : ' added successfully'));
      resetForm();
      await load();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('cancel-btn').addEventListener('click', resetForm);
  search.addEventListener('input', draw);

  tbody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');
    if (editBtn) {
      const r = rows.find((x) => String(x.id) === editBtn.dataset.edit);
      if (!r) return;
      cfg.fields.forEach((f) => { form.elements[f.name].value = r[f.name] ?? ''; });
      editId = r.id;
      formTitle.textContent = 'Edit ' + cfg.single + ' #' + r.id;
      submitBtn.textContent = 'Update';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (delBtn && confirm('Are you sure you want to delete this record?')) {
      try {
        await api(`${cfg.endpoint}/${delBtn.dataset.del}`, 'DELETE');
        toast(cfg.single + ' deleted');
        if (String(editId) === delBtn.dataset.del) resetForm();
        await load();
      } catch (err) { toast(err.message, 'error'); }
    }
  });

  await load();
  return { form, reload: load };
}
