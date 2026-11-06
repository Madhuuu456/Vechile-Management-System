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
    header.insertAdjacentHTML('afterend', '<div class="demo-banner">🧪 Demo version: the data you enter is saved only in your own browser. The full MySQL version runs on a computer (see the GitHub README).</div>');
  }
  const footer = document.getElementById('footer');
  if (footer) {
    footer.innerHTML = `<footer>© ${new Date().getFullYear()} Madhu Vehicle Service Management System<br>Demo version - data is saved only in this browser. <a href="#" id="resetDemo">Reset demo data</a></footer>`;
    document.getElementById('resetDemo').onclick = (e) => {
      e.preventDefault();
      if (confirm('Delete all demo data and start fresh?')) {
        try { localStorage.removeItem('madhu_demo_db_v1'); } catch (err) { /* ignore */ }
        location.reload();
      }
    };
  }
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

// ===== DEMO MODE =====
// This GitHub Pages version has no server and no MySQL.
// Data is saved in your own browser (localStorage) so everything still works.
const DB_KEY = 'madhu_demo_db_v1';
let memoryDb = null;

function freshDb() {
  return {
    seq: { customers: 1, vehicles: 1, services: 6, bookings: 1, payments: 1 },
    customers: [],
    vehicles: [],
    services: [
      { id: 1, name: 'General Service', description: 'Oil change, filter check and washing', price: 1500 },
      { id: 2, name: 'Oil Change', description: 'Engine oil and oil filter replacement', price: 800 },
      { id: 3, name: 'Brake Repair', description: 'Brake pad and brake oil check/replacement', price: 1200 },
      { id: 4, name: 'Tyre Replacement', description: 'Tyre fitting and wheel balancing', price: 3000 },
      { id: 5, name: 'Battery Replacement', description: 'New battery with fitting', price: 4500 }
    ],
    bookings: [],
    payments: []
  };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage blocked: use memory */ }
  if (!memoryDb) memoryDb = freshDb();
  return memoryDb;
}

function saveDb(db) {
  memoryDb = db;
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}

const TABLES = {
  customers: { fields: ['name', 'phone', 'email', 'address'], required: ['name', 'phone'], ints: [], decimals: [] },
  vehicles: { fields: ['customer_id', 'reg_number', 'make', 'model', 'year', 'type'], required: ['customer_id', 'reg_number', 'make', 'model', 'type'], ints: ['customer_id', 'year'], decimals: [] },
  services: { fields: ['name', 'description', 'price'], required: ['name', 'price'], ints: [], decimals: ['price'] },
  bookings: { fields: ['vehicle_id', 'service_id', 'service_date', 'status', 'notes'], required: ['vehicle_id', 'service_id', 'service_date', 'status'], ints: ['vehicle_id', 'service_id'], decimals: [] },
  payments: { fields: ['booking_id', 'amount', 'method', 'pay_date', 'status'], required: ['booking_id', 'amount', 'method', 'pay_date', 'status'], ints: ['booking_id'], decimals: ['amount'] }
};

const MSG_REQUIRED = 'Please fill in all required fields.';
const MSG_DUP = 'This record already exists (duplicate value).';
const MSG_FK = 'Please choose a valid related record.';
const MSG_USED = 'Cannot delete: this record is used on other pages. Delete the related records first.';

function normalise(table, body) {
  const t = TABLES[table];
  const row = {};
  t.fields.forEach((f) => {
    let v = body ? body[f] : null;
    if (v === undefined || v === null || String(v).trim() === '') v = null;
    row[f] = v;
  });
  t.required.forEach((f) => { if (row[f] === null) throw new Error(MSG_REQUIRED); });
  t.ints.forEach((f) => {
    if (row[f] !== null) {
      row[f] = parseInt(row[f], 10);
      if (Number.isNaN(row[f])) throw new Error('Please enter a valid number for ' + f.replace('_', ' ') + '.');
    }
  });
  t.decimals.forEach((f) => {
    if (row[f] !== null) {
      row[f] = Math.round(Number(row[f]) * 100) / 100;
      if (Number.isNaN(row[f])) throw new Error('Please enter a valid amount.');
    }
  });
  return row;
}

function checkRules(table, row, db, selfId) {
  const exists = (list, id) => list.some((x) => x.id === id);
  if (table === 'vehicles') {
    if (!exists(db.customers, row.customer_id)) throw new Error(MSG_FK);
    const dup = db.vehicles.some((v) => v.id !== selfId && v.reg_number.toLowerCase() === row.reg_number.toLowerCase());
    if (dup) throw new Error(MSG_DUP);
  }
  if (table === 'bookings') {
    if (!exists(db.vehicles, row.vehicle_id) || !exists(db.services, row.service_id)) throw new Error(MSG_FK);
  }
  if (table === 'payments') {
    if (!exists(db.bookings, row.booking_id)) throw new Error(MSG_FK);
  }
}

function isUsed(table, id, db) {
  if (table === 'customers') return db.vehicles.some((v) => v.customer_id === id);
  if (table === 'vehicles') return db.bookings.some((b) => b.vehicle_id === id);
  if (table === 'services') return db.bookings.some((b) => b.service_id === id);
  if (table === 'bookings') return db.payments.some((p) => p.booking_id === id);
  return false;
}

function by(list, id) { return list.find((x) => x.id === id) || {}; }

function view(table, db) {
  let rows;
  if (table === 'vehicles') {
    rows = db.vehicles.map((v) => ({ ...v, customer_name: by(db.customers, v.customer_id).name }));
  } else if (table === 'bookings') {
    rows = db.bookings.map((b) => {
      const v = by(db.vehicles, b.vehicle_id);
      const s = by(db.services, b.service_id);
      return { ...b, reg_number: v.reg_number, customer_name: by(db.customers, v.customer_id).name, service_name: s.name, price: s.price };
    });
  } else if (table === 'payments') {
    rows = db.payments.map((p) => {
      const b = by(db.bookings, p.booking_id);
      const v = by(db.vehicles, b.vehicle_id);
      return { ...p, reg_number: v.reg_number, customer_name: by(db.customers, v.customer_id).name, service_name: by(db.services, b.service_id).name };
    });
  } else {
    rows = db[table].map((r) => ({ ...r }));
  }
  return rows.sort((a, b) => b.id - a.id);
}

function stats(db) {
  const sum = (list) => list.reduce((t, p) => t + Number(p.amount), 0);
  const paid = db.payments.filter((p) => p.status === 'Paid');
  const pending = db.payments.filter((p) => p.status === 'Pending');
  const bookings = view('bookings', db);

  const statusCount = {};
  db.bookings.forEach((b) => { statusCount[b.status] = (statusCount[b.status] || 0) + 1; });

  const serviceCount = db.services.map((s) => ({ name: s.name, c: db.bookings.filter((b) => b.service_id === s.id).length }))
    .sort((a, b) => b.c - a.c || a.name.localeCompare(b.name)).slice(0, 5);

  const months = {};
  paid.forEach((p) => { const m = String(p.pay_date).slice(0, 7); months[m] = (months[m] || 0) + Number(p.amount); });
  const monthly = Object.keys(months).sort().reverse().slice(0, 6).map((m) => ({ m, total: months[m] }));

  return {
    customers: db.customers.length,
    vehicles: db.vehicles.length,
    services: db.services.length,
    bookings: db.bookings.length,
    activeBookings: db.bookings.filter((b) => b.status === 'Pending' || b.status === 'In Progress').length,
    revenue: sum(paid),
    pendingPayments: sum(pending),
    recent: bookings.slice(0, 5),
    byStatus: Object.keys(statusCount).map((status) => ({ status, c: statusCount[status] })),
    topServices: serviceCount,
    monthly
  };
}

// Same name and same use as the real version, so all pages work without changes
async function api(url, method, body) {
  method = method || 'GET';
  const m = String(url).match(/^\/api\/([a-z]+)(?:\/(\d+))?$/);
  if (!m) throw new Error('Unknown request');
  const name = m[1];
  const id = m[2] ? Number(m[2]) : null;
  const db = loadDb();

  if (name === 'stats') return stats(db);
  if (!TABLES[name]) throw new Error('Unknown request');

  if (method === 'GET') return view(name, db);

  if (method === 'POST') {
    const row = normalise(name, body);
    checkRules(name, row, db, null);
    row.id = db.seq[name]++;
    db[name].push(row);
    saveDb(db);
    return { id: row.id };
  }

  if (method === 'PUT') {
    const idx = db[name].findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Record not found');
    const row = normalise(name, body);
    checkRules(name, row, db, id);
    row.id = id;
    db[name][idx] = row;
    saveDb(db);
    return { ok: true };
  }

  if (method === 'DELETE') {
    if (isUsed(name, id, db)) throw new Error(MSG_USED);
    db[name] = db[name].filter((r) => r.id !== id);
    saveDb(db);
    return { ok: true };
  }

  throw new Error('Unknown request');
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
