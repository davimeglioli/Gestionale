const el = {
  search: document.getElementById('searchInput'),
  suggestions: document.getElementById('suggestions'),
  cards: document.getElementById('cards'),
  addBtn: document.getElementById('addBtn'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  closeModal: document.getElementById('closeModal'),
  form: document.getElementById('quoteForm'),
  save: document.getElementById('saveQuote'),
  del: document.getElementById('deleteQuote'),
  confirmModal: document.getElementById('confirmModal'),
  closeConfirm: document.getElementById('closeConfirm'),
  confirmDelete: document.getElementById('confirmDelete'),
  cancelDelete: document.getElementById('cancelDelete'),
  cancel: document.getElementById('cancelModal'),
};

let currentOrder = null;
let currentErrors = {};

function fetchQuotes(q = '') {
  const url = q ? `/api/quotes?q=${encodeURIComponent(q)}` : '/api/quotes';
  return fetch(url).then(r => r.json()).then(drawCards);
}

function drawCards(quotes) {
  el.cards.innerHTML = '';
  quotes.forEach(q => {
    const c = document.createElement('div');
    c.className = 'card';
    const code = q.item_code || '';
    c.innerHTML = `
      <div class="row">
        <div>
          <div><strong>${code}</strong></div>
          <div class="muted">Ordine #${q.order_number}</div>
        </div>
        <button class="expand">Apri</button>
      </div>
      <div>${q.customer_first_name || ''} ${q.customer_last_name || ''}</div>
    `;
    c.querySelector('.expand').addEventListener('click', () => openDetail(q.order_number));
    el.cards.appendChild(c);
  });
}

function openDetail(orderNumber) {
  currentOrder = orderNumber;
  fetch(`/api/quote/${orderNumber}`).then(r => r.json()).then(data => {
    el.modalTitle.textContent = `Preventivo #${orderNumber}`;
    buildForm(data);
    el.modal.classList.remove('hidden');
    el.del.style.display = '';
  });
}

function buildField(key, label, type = 'text', value = '') {
  const w = document.createElement('div');
  w.className = 'field';
  const l = document.createElement('label');
  l.textContent = label;
  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
  } else {
    input = document.createElement('input');
    input.type = type;
  }
  input.name = key;
  input.value = value == null ? '' : value;
  input.required = true;
  if (type === 'number') {
    input.min = '0';
    input.step = '0.01';
  }
  if (key === 'total_price') {
    input.readOnly = true;
  }
  w.appendChild(l);
  w.appendChild(input);
  const err = document.createElement('div');
  err.className = 'error-msg';
  err.style.display = 'none';
  w.appendChild(err);
  return w;
}

function buildForm(data = null) {
  el.form.innerHTML = '';
  const fields = [
    ['customer_first_name','Nome','text'],
    ['customer_last_name','Cognome','text'],
    ['customer_birthdate','Data di nascita','date'],
    ['tax_code','Codice Fiscale','text'],
    ['item_type','Tipo','text'],
    ['item_code','Codice','text'],
    ['description','Descrizione','textarea'],
    ['unit','Unità di misura','text'],
    ['quantity','Quantità','number'],
    ['unit_price','Prezzo unitario','number'],
    ['total_price','Prezzo totale','number'],
    ['mr_unit_price','MR prezzo unitario','number'],
    ['mr_total_price','MR prezzo totale','number'],
    ['mr_markup','MR ricarico','number'],
    ['labor_unit_price','ManoR prezzo unitario','number'],
    ['labor_total_price','ManoR prezzo totale','number'],
    ['labor_markup','ManoR ricarico','number'],
    ['pm_unit_price','PM prezzo unitario','number'],
    ['pm_total_price','PM prezzo totale','number'],
    ['cm_unit_price','CM prezzo unitario','number'],
    ['cm_total_price','CM prezzo totale','number'],
  ];
  fields.forEach(([k, label, type]) => {
    const v = data ? data[k] : '';
    const f = buildField(k, label, type, v);
    el.form.appendChild(f);
  });
  const qty = el.form.querySelector('input[name="quantity"]');
  const unitPrice = el.form.querySelector('input[name="unit_price"]');
  const totalPrice = el.form.querySelector('input[name="total_price"]');
  const recalc = () => {
    const q = parseFloat(qty.value || '0');
    const u = parseFloat(unitPrice.value || '0');
    totalPrice.value = (q * u).toFixed(2);
  };
  qty.addEventListener('input', recalc);
  unitPrice.addEventListener('input', recalc);
  recalc();

  // validate on input changes
  const inputs = el.form.querySelectorAll('input, textarea, select');
  inputs.forEach(i => i.addEventListener('input', validateAndRender));
  validateAndRender();
}

function collectForm() {
  const data = {};
  const inputs = el.form.querySelectorAll('input, textarea, select');
  inputs.forEach(i => {
    let v = i.value;
    if (i.type === 'number') v = v ? parseFloat(v) : null;
    data[i.name] = v;
  });
  return data;
}

function setFieldError(name, message) {
  const wrapper = Array.from(el.form.querySelectorAll('.field')).find(f => {
    const input = f.querySelector('[name]');
    return input && input.name === name;
  });
  if (!wrapper) return;
  const input = wrapper.querySelector('[name]');
  const err = wrapper.querySelector('.error-msg');
  if (message) {
    input.classList.add('invalid');
    err.textContent = message;
    err.style.display = 'block';
  } else {
    input.classList.remove('invalid');
    err.textContent = '';
    err.style.display = 'none';
  }
}

function validateAndRender() {
  const data = collectForm();
  const errors = validate(data);
  currentErrors = errors;
  // render
  const allNames = [
    'customer_first_name','customer_last_name','customer_birthdate','tax_code','item_type','item_code','description','unit',
    'quantity','unit_price','total_price','mr_unit_price','mr_total_price','mr_markup','labor_unit_price','labor_total_price','labor_markup',
    'pm_unit_price','pm_total_price','cm_unit_price','cm_total_price'
  ];
  allNames.forEach(n => setFieldError(n, errors[n] || null));
  const valid = Object.keys(errors).length === 0;
  el.save.disabled = !valid;
  return valid;
}

function validate(data) {
  const errors = {};
  const required = [
    'customer_first_name','customer_last_name','customer_birthdate','tax_code','item_type','item_code','description','unit',
    'quantity','unit_price','total_price','mr_unit_price','mr_total_price','mr_markup','labor_unit_price','labor_total_price','labor_markup',
    'pm_unit_price','pm_total_price','cm_unit_price','cm_total_price'
  ];
  required.forEach(f => {
    const v = data[f];
    if (!v || (typeof v === 'string' && !v.trim())) errors[f] = 'campo obbligatorio';
  });
  const numeric = ['quantity','unit_price','total_price','mr_unit_price','mr_total_price','mr_markup','labor_unit_price','labor_total_price','labor_markup','pm_unit_price','pm_total_price','cm_unit_price','cm_total_price'];
  numeric.forEach(f => {
    const v = data[f];
    if (v != null && v !== '') {
      const num = Number(v);
      if (Number.isNaN(num)) errors[f] = 'deve essere un numero';
      else if (num < 0) errors[f] = 'non può essere negativo';
    }
  });
  const q = Number(data.quantity || 0);
  if (!Number.isNaN(q) && q <= 0) errors.quantity = 'deve essere maggiore di 0';
  const u = Number(data.unit_price || 0);
  if (!Number.isNaN(q) && !Number.isNaN(u)) {
    const expected = Number((q * u).toFixed(2));
    const t = Number(data.total_price || 0);
    if (!Number.isNaN(t) && (Math.round(t * 100) / 100) !== expected) {
      errors.total_price = 'non coerente con quantità × prezzo unitario';
    }
  }
  return errors;
}

function openCreate() {
  currentOrder = null;
  el.modalTitle.textContent = 'Nuovo Preventivo';
  buildForm(null);
  el.modal.classList.remove('hidden');
  el.del.style.display = 'none';
}

function closeModals() {
  el.modal.classList.add('hidden');
  el.confirmModal.classList.add('hidden');
}

function handleSave() {
  if (!validateAndRender()) return;
  const payload = collectForm();
  const opts = { method: currentOrder == null ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  const url = currentOrder == null ? '/api/quote' : `/api/quote/${currentOrder}`;
  fetch(url, opts)
    .then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok && data && data.errors) {
        Object.entries(data.errors).forEach(([k,v]) => setFieldError(k, v));
        el.save.disabled = true;
        return Promise.reject(data);
      }
      return data;
    })
    .then(() => { closeModals(); fetchQuotes(el.search.value.trim()); })
    .catch(() => {});
}

function handleDelete() {
  if (currentOrder == null) return;
  el.confirmModal.classList.remove('hidden');
}

function confirmDel() {
  fetch(`/api/quote/${currentOrder}`, { method: 'DELETE' }).then(r => r.json()).then(() => { closeModals(); fetchQuotes(el.search.value.trim()); });
}

function searchInputHandler() {
  const q = el.search.value.trim();
  fetchQuotes(q);
  if (!q) { el.suggestions.classList.add('hidden'); el.suggestions.innerHTML = ''; return; }
  fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`).then(r => r.json()).then(list => {
    if (!list.length) { el.suggestions.classList.add('hidden'); el.suggestions.innerHTML = ''; return; }
    el.suggestions.innerHTML = '';
    list.forEach(s => {
      const div = document.createElement('div');
      div.textContent = s;
      div.addEventListener('click', () => { el.search.value = s; el.suggestions.classList.add('hidden'); fetchQuotes(s); });
      el.suggestions.appendChild(div);
    });
    el.suggestions.classList.remove('hidden');
  });
}

el.addBtn.addEventListener('click', openCreate);
el.closeModal.addEventListener('click', closeModals);
el.cancel.addEventListener('click', closeModals);
el.save.addEventListener('click', handleSave);
el.del.addEventListener('click', handleDelete);
el.closeConfirm.addEventListener('click', closeModals);
el.cancelDelete.addEventListener('click', closeModals);
el.confirmDelete.addEventListener('click', confirmDel);
el.search.addEventListener('input', searchInputHandler);

fetchQuotes();