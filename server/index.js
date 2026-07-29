/**
 * Radar Financeiro - servidor Express (API + frontend estatico).
 * "Tudo o que voce vai pagar, antes de precisar pagar."
 */
const path = require('path');
const fs = require('fs');

// Carregador minimo de .env (sem dependencia externa)
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) { /* ignora */ }
})();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const store = require('./store');
const fin = require('./finance');
const proj = require('./projection');
const importer = require('./importer');
const projmod = require('./projects');
const evmod = require('./events');
const pdfgen = require('./pdf');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque-esta-chave-no-arquivo-.env';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.json({ limit: '20mb' }));

// ---------- Helpers ----------
function ok(res, data) { res.json(data); }
function bad(res, msg, code = 400) { res.status(code).json({ error: msg }); }

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return bad(res, 'Nao autenticado', 401);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return bad(res, 'Sessao invalida ou expirada', 401);
  }
}

// ---------- Auth ----------
app.get('/api/auth/status', (req, res) => {
  const d = store.getData();
  ok(res, { hasUser: !!d.user });
});

app.post('/api/auth/register', (req, res) => {
  const d = store.getData();
  if (d.user) return bad(res, 'Ja existe um usuario cadastrado. Faca login.');
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) return bad(res, 'Informe email e senha (min. 6 caracteres).');
  d.user = { email: String(email).toLowerCase(), passwordHash: bcrypt.hashSync(password, 10), createdAt: new Date().toISOString() };
  store.saveWithBackup();
  const token = jwt.sign({ email: d.user.email }, JWT_SECRET, { expiresIn: '30d' });
  ok(res, { token, email: d.user.email });
});

app.post('/api/auth/login', (req, res) => {
  const d = store.getData();
  const { email, password } = req.body || {};
  if (!d.user) return bad(res, 'Nenhum usuario cadastrado. Crie sua conta.');
  if (!email || !password) return bad(res, 'Informe email e senha.');
  if (String(email).toLowerCase() !== d.user.email || !bcrypt.compareSync(password, d.user.passwordHash))
    return bad(res, 'Credenciais invalidas.', 401);
  const token = jwt.sign({ email: d.user.email }, JWT_SECRET, { expiresIn: '30d' });
  ok(res, { token, email: d.user.email });
});

app.post('/api/auth/change-password', auth, (req, res) => {
  const d = store.getData();
  const { current, next } = req.body || {};
  if (!bcrypt.compareSync(current || '', d.user.passwordHash)) return bad(res, 'Senha atual incorreta.');
  if (!next || next.length < 6) return bad(res, 'Nova senha muito curta.');
  d.user.passwordHash = bcrypt.hashSync(next, 10);
  store.saveWithBackup();
  ok(res, { success: true });
});

// Tudo abaixo exige autenticacao
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();
  return auth(req, res, next);
});

// ---------- Settings ----------
app.get('/api/settings', (req, res) => ok(res, store.getData().settings));
app.put('/api/settings', (req, res) => {
  const d = store.getData();
  d.settings = Object.assign(d.settings, req.body || {});
  if (d.settings.currentBalance != null) d.settings.currentBalance = Number(d.settings.currentBalance);
  store.scheduleBackup();
  ok(res, d.settings);
});

// ---------- Cartoes ----------
app.get('/api/cards', (req, res) => ok(res, proj.cardsStatus(store.getData())));
app.post('/api/cards', (req, res) => {
  const d = store.getData();
  const { name, bank, limitTotal, closingDay, dueDay, color } = req.body || {};
  if (!name || !limitTotal) return bad(res, 'Nome e limite sao obrigatorios.');
  const card = {
    id: store.id(), name, bank: bank || '', limitTotal: Number(limitTotal),
    closingDay: Number(closingDay) || 1, dueDay: Number(dueDay) || 10,
    color: color || '#6366f1', createdAt: new Date().toISOString()
  };
  d.cards.push(card);
  store.scheduleBackup();
  ok(res, card);
});
app.put('/api/cards/:id', (req, res) => {
  const d = store.getData();
  const c = d.cards.find(x => x.id === req.params.id);
  if (!c) return bad(res, 'Cartao nao encontrado', 404);
  const b = req.body || {};
  ['name', 'bank', 'color'].forEach(k => { if (b[k] != null) c[k] = b[k]; });
  ['limitTotal', 'closingDay', 'dueDay'].forEach(k => { if (b[k] != null) c[k] = Number(b[k]); });
  store.scheduleBackup();
  ok(res, c);
});
app.delete('/api/cards/:id', (req, res) => {
  const d = store.getData();
  d.cards = d.cards.filter(c => c.id !== req.params.id);
  d.installments = d.installments.filter(i => i.cardId !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});

// ---------- Parcelamentos (compras no cartao) ----------
app.get('/api/installments', (req, res) => {
  const d = store.getData();
  const cardName = {};
  d.cards.forEach(c => cardName[c.id] = c.name);
  ok(res, d.installments.map(i => ({ ...i, cardName: cardName[i.cardId] || '-' })));
});
app.post('/api/installments', (req, res) => {
  const d = store.getData();
  const { cardId, description, category, purchaseDate, totalAmount, numInstallments } = req.body || {};
  const card = d.cards.find(c => c.id === cardId);
  if (!card) return bad(res, 'Selecione um cartao valido.');
  if (!totalAmount || !numInstallments) return bad(res, 'Valor e numero de parcelas sao obrigatorios.');
  const items = fin.generateCardInstallments(
    purchaseDate || new Date().toISOString().slice(0, 10),
    card.closingDay, card.dueDay, Number(totalAmount), Number(numInstallments)
  );
  const { reimbursePerson, reimburseTotal } = req.body || {};
  if (reimbursePerson && Number(reimburseTotal) > 0) {
    const shares = fin.splitAmount(Number(reimburseTotal), items.length);
    items.forEach((it, i) => { it.reimburseAmount = shares[i]; it.reimburseReceived = false; });
  }
  const inst = {
    id: store.id(), cardId, description: description || 'Compra',
    category: category || 'Outros', purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
    totalAmount: Number(totalAmount), numInstallments: Number(numInstallments),
    reimbursePerson: reimbursePerson || null,
    items, createdAt: new Date().toISOString()
  };
  d.installments.push(inst);
  store.scheduleBackup();
  ok(res, inst);
});
app.delete('/api/installments/:id', (req, res) => {
  const d = store.getData();
  d.installments = d.installments.filter(i => i.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});
app.post('/api/installments/:id/pay/:number', (req, res) => {
  const d = store.getData();
  const inst = d.installments.find(i => i.id === req.params.id);
  if (!inst) return bad(res, 'Nao encontrado', 404);
  const it = inst.items.find(x => x.number === Number(req.params.number));
  if (!it) return bad(res, 'Parcela nao encontrada', 404);
  it.paid = !it.paid;
  it.paidDate = it.paid ? new Date().toISOString().slice(0, 10) : null;
  store.scheduleBackup();
  ok(res, inst);
});

// editar compra parcelada (descricao, categoria, quem reembolsa)
app.put('/api/installments/:id', (req, res) => {
  const d = store.getData();
  const inst = d.installments.find(i => i.id === req.params.id);
  if (!inst) return bad(res, 'Nao encontrado', 404);
  const b = req.body || {};
  if (b.description != null) inst.description = b.description;
  if (b.category != null) inst.category = b.category;
  if (b.reimbursePerson !== undefined) inst.reimbursePerson = b.reimbursePerson || null;
  store.scheduleBackup();
  ok(res, inst);
});
// editar parcelas individualmente (valor, vencimento, parte de terceiro) em lote
app.put('/api/installments/:id/items', (req, res) => {
  const d = store.getData();
  const inst = d.installments.find(i => i.id === req.params.id);
  if (!inst) return bad(res, 'Nao encontrado', 404);
  const b = req.body || {};
  if (b.reimbursePerson !== undefined) inst.reimbursePerson = b.reimbursePerson || null;
  for (const u of (Array.isArray(b.items) ? b.items : [])) {
    const it = inst.items.find(x => x.number === Number(u.number));
    if (!it) continue;
    if (u.amount != null && u.amount !== '') it.amount = Math.round(Number(u.amount) * 100) / 100;
    if (u.dueISO) { it.dueISO = u.dueISO; it.month = u.dueISO.slice(0, 7); }
    if (u.reimburseAmount != null && u.reimburseAmount !== '') it.reimburseAmount = Math.max(0, Math.round(Number(u.reimburseAmount) * 100) / 100);
    if (u.paid != null) { it.paid = !!u.paid; it.paidDate = it.paid ? new Date().toISOString().slice(0, 10) : null; }
    if (u.reimburseReceived != null) { it.reimburseReceived = !!u.reimburseReceived; it.reimburseReceivedDate = it.reimburseReceived ? new Date().toISOString().slice(0, 10) : null; }
  }
  inst.totalAmount = Math.round(inst.items.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  store.scheduleBackup();
  ok(res, inst);
});
// alternar recebimento do reembolso de uma parcela
app.post('/api/installments/:id/reimburse/:number', (req, res) => {
  const d = store.getData();
  const inst = d.installments.find(i => i.id === req.params.id);
  if (!inst) return bad(res, 'Nao encontrado', 404);
  const it = inst.items.find(x => x.number === Number(req.params.number));
  if (!it) return bad(res, 'Parcela nao encontrada', 404);
  it.reimburseReceived = !it.reimburseReceived;
  it.reimburseReceivedDate = it.reimburseReceived ? new Date().toISOString().slice(0, 10) : null;
  store.scheduleBackup();
  ok(res, inst);
});

// ---------- Emprestimos a terceiros (a receber) ----------
app.get('/api/loans', (req, res) => ok(res, proj.loansStatus(store.getData())));
app.get('/api/receivables', (req, res) => ok(res, proj.receivables(store.getData())));
app.post('/api/loans', (req, res) => {
  const d = store.getData();
  const { person, description, totalAmount, numInstallments, method, firstDueISO, cardId, createCardExpense } = req.body || {};
  if (!person || !totalAmount || !numInstallments) return bad(res, 'Nome, valor e parcelas sao obrigatorios.');
  const first = firstDueISO || new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10);
  const items = fin.generateSchedule(first, Number(totalAmount), Number(numInstallments));
  const loan = {
    id: store.id(), person, description: description || 'Emprestimo',
    totalAmount: Number(totalAmount), numInstallments: Number(numInstallments),
    method: method || 'A definir', cardId: cardId || null, items, createdAt: new Date().toISOString()
  };
  d.loans.push(loan);
  // se foi comprado no cartao, gera tambem a saida (fatura que o usuario paga)
  if (cardId && createCardExpense) {
    const card = d.cards.find(c => c.id === cardId);
    if (card) {
      const cItems = fin.generateCardInstallments(new Date().toISOString().slice(0, 10), card.closingDay, card.dueDay, Number(totalAmount), Number(numInstallments));
      d.installments.push({
        id: store.id(), cardId, description: `Emprestimo p/ ${person}: ${description || ''}`.trim(),
        category: 'Emprestimo', purchaseDate: new Date().toISOString().slice(0, 10),
        totalAmount: Number(totalAmount), numInstallments: Number(numInstallments),
        items: cItems, linkedLoanId: loan.id, createdAt: new Date().toISOString()
      });
    }
  }
  store.scheduleBackup();
  ok(res, loan);
});
app.delete('/api/loans/:id', (req, res) => {
  const d = store.getData();
  d.loans = d.loans.filter(l => l.id !== req.params.id);
  d.installments = d.installments.filter(i => i.linkedLoanId !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});
app.post('/api/loans/:id/receive/:number', (req, res) => {
  const d = store.getData();
  const loan = d.loans.find(l => l.id === req.params.id);
  if (!loan) return bad(res, 'Nao encontrado', 404);
  const it = loan.items.find(x => x.number === Number(req.params.number));
  if (!it) return bad(res, 'Parcela nao encontrada', 404);
  it.settled = !it.settled;
  it.settledDate = it.settled ? new Date().toISOString().slice(0, 10) : null;
  store.scheduleBackup();
  ok(res, loan);
});

// ---------- Recorrentes ----------
app.get('/api/recurrings', (req, res) => ok(res, store.getData().recurrings));
app.post('/api/recurrings', (req, res) => {
  const d = store.getData();
  const { type, description, category, amount, dayOfMonth, startMonth, endMonth } = req.body || {};
  if (!description || !amount) return bad(res, 'Descricao e valor sao obrigatorios.');
  const r = {
    id: store.id(), type: type === 'income' ? 'income' : 'expense',
    description, category: category || 'Recorrente', amount: Number(amount),
    dayOfMonth: Number(dayOfMonth) || 1, startMonth: startMonth || proj.currentMonthKey(),
    endMonth: endMonth || null, active: true, createdAt: new Date().toISOString()
  };
  d.recurrings.push(r);
  store.scheduleBackup();
  ok(res, r);
});
app.put('/api/recurrings/:id', (req, res) => {
  const d = store.getData();
  const r = d.recurrings.find(x => x.id === req.params.id);
  if (!r) return bad(res, 'Nao encontrado', 404);
  Object.assign(r, req.body || {});
  if (r.amount != null) r.amount = Number(r.amount);
  store.scheduleBackup();
  ok(res, r);
});
app.delete('/api/recurrings/:id', (req, res) => {
  const d = store.getData();
  d.recurrings = d.recurrings.filter(r => r.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});

// ---------- Lancamentos avulsos ----------
app.get('/api/transactions', (req, res) => ok(res, store.getData().transactions));
app.post('/api/transactions', (req, res) => {
  const d = store.getData();
  const { type, description, category, amount, dateISO } = req.body || {};
  if (!amount) return bad(res, 'Valor obrigatorio.');
  const date = dateISO || new Date().toISOString().slice(0, 10);
  const t = {
    id: store.id(), type: type === 'income' ? 'income' : 'expense',
    description: description || '', category: category || 'Outros',
    amount: Number(amount), dateISO: date, month: fin.monthKey(date),
    source: 'manual', createdAt: new Date().toISOString()
  };
  d.transactions.push(t);
  store.scheduleBackup();
  ok(res, t);
});
app.delete('/api/transactions/:id', (req, res) => {
  const d = store.getData();
  d.transactions = d.transactions.filter(t => t.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});

// ---------- Encargos / lancamentos avulsos de cartao ----------
// Armazenados em d.cardCharges: [{ id, cardId, month, description, category, amount, dateISO, createdAt }]
app.get('/api/card-charges', (req, res) => {
  const d = store.getData();
  if (!d.cardCharges) d.cardCharges = [];
  const { cardId, month } = req.query;
  let list = d.cardCharges;
  if (cardId) list = list.filter(c => c.cardId === cardId);
  if (month) list = list.filter(c => c.month === month);
  ok(res, list);
});
app.post('/api/card-charges', (req, res) => {
  const d = store.getData();
  if (!d.cardCharges) d.cardCharges = [];
  const { cardId, month, description, category, amount, dateISO } = req.body || {};
  if (!cardId || !month || !amount) return bad(res, 'cardId, month e amount sao obrigatorios.');
  const date = dateISO || month + '-01';
  const charge = {
    id: store.id(), cardId, month, description: description || 'Encargo',
    category: category || 'Encargos', amount: Math.round(Number(amount) * 100) / 100,
    dateISO: date, createdAt: new Date().toISOString()
  };
  d.cardCharges.push(charge);
  store.scheduleBackup();
  ok(res, charge);
});
app.delete('/api/card-charges/:id', (req, res) => {
  const d = store.getData();
  if (!d.cardCharges) d.cardCharges = [];
  d.cardCharges = d.cardCharges.filter(c => c.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});

// ---------- Projeto de Vida ----------
app.get('/api/projects', (req, res) => ok(res, store.getData().projects.map(projmod.projectSummary)));
app.get('/api/projects/:id', (req, res) => {
  const p = store.getData().projects.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Projeto nao encontrado', 404);
  ok(res, { project: p, computed: projmod.computeProject(p), alerts: projmod.projectAlerts(p, projmod.computeProject(p)) });
});
app.post('/api/projects', (req, res) => {
  const d = store.getData();
  const p = projmod.blankProject(store.id(), (req.body && req.body.name) || 'Novo projeto');
  d.projects.push(p);
  store.scheduleBackup();
  ok(res, p);
});
app.put('/api/projects/:id', (req, res) => {
  const d = store.getData();
  const idx = d.projects.findIndex(x => x.id === req.params.id);
  if (idx < 0) return bad(res, 'Projeto nao encontrado', 404);
  const b = req.body || {};
  // preserva id/createdAt; substitui o resto pelos campos enviados
  d.projects[idx] = Object.assign({}, d.projects[idx], b, { id: d.projects[idx].id, createdAt: d.projects[idx].createdAt });
  store.scheduleBackup();
  ok(res, d.projects[idx]);
});
app.delete('/api/projects/:id', (req, res) => {
  const d = store.getData();
  d.projects = d.projects.filter(x => x.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});
// aporte/resgate no fundo, com integracao opcional ao fluxo de caixa
app.post('/api/projects/:id/fund', (req, res) => {
  const d = store.getData();
  const p = d.projects.find(x => x.id === req.params.id);
  if (!p) return bad(res, 'Projeto nao encontrado', 404);
  const { type, amount, note, date, affectCashflow } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return bad(res, 'Informe um valor valido.');
  const dateISO = date || new Date().toISOString().slice(0, 10);
  if (!p.fund) p.fund = { initial: 0, entries: [] };
  p.fund.entries.push({ id: store.id(), date: dateISO, type: type === 'resgate' ? 'resgate' : 'aporte', amount: amt, note: note || '' });
  if (affectCashflow) {
    // aporte sai do fluxo (despesa); resgate volta (receita)
    d.transactions.push({
      id: store.id(), type: type === 'resgate' ? 'income' : 'expense',
      description: (type === 'resgate' ? 'Resgate ' : 'Aporte ') + p.name, category: 'Projeto de Vida',
      amount: amt, dateISO, month: fin.monthKey(dateISO), source: 'projeto', createdAt: new Date().toISOString()
    });
  }
  store.scheduleBackup();
  ok(res, { project: p, computed: projmod.computeProject(p) });
});

// ---------- Eventos ----------
app.get('/api/events', (req, res) => ok(res, store.getData().events.map(evmod.eventSummary)));
app.get('/api/events/:id', (req, res) => {
  const e = store.getData().events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const c = evmod.computeEvent(e);
  ok(res, { event: e, computed: c, alerts: evmod.eventAlerts(e, c) });
});
app.post('/api/events', (req, res) => {
  const d = store.getData();
  const e = evmod.blankEvent(store.id(), (req.body && req.body.name) || 'Novo evento');
  d.events.push(e);
  store.scheduleBackup();
  ok(res, e);
});
app.put('/api/events/:id', (req, res) => {
  const d = store.getData();
  const i = d.events.findIndex(x => x.id === req.params.id);
  if (i < 0) return bad(res, 'Evento nao encontrado', 404);
  d.events[i] = Object.assign({}, d.events[i], req.body || {}, { id: d.events[i].id, createdAt: d.events[i].createdAt });
  store.scheduleBackup();
  ok(res, d.events[i]);
});
app.delete('/api/events/:id', (req, res) => {
  const d = store.getData();
  d.events = d.events.filter(x => x.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});
// pagamento a fornecedor (opcionalmente lancado no fluxo de caixa)
app.post('/api/events/:id/pay', (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const { vendorId, amount, date, affectCashflow } = req.body || {};
  const v = (e.vendors || []).find(x => x.id === vendorId);
  if (!v) return bad(res, 'Fornecedor nao encontrado', 404);
  const amt = Number(amount);
  if (!amt || amt <= 0) return bad(res, 'Informe um valor valido.');
  v.paid = round2n((Number(v.paid) || 0) + amt);
  const dateISO = date || new Date().toISOString().slice(0, 10);
  if (affectCashflow) {
    d.transactions.push({
      id: store.id(), type: 'expense', description: 'Evento ' + e.name + ' - ' + v.name,
      category: 'Eventos', amount: amt, dateISO, month: fin.monthKey(dateISO),
      source: 'evento', createdAt: new Date().toISOString()
    });
  }
  store.scheduleBackup();
  ok(res, { event: e, computed: evmod.computeEvent(e) });
});
// recebimento de honorarios do cliente (opcionalmente lancado como receita)
app.post('/api/events/:id/receive', (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const { amount, date, note, affectCashflow } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return bad(res, 'Informe um valor valido.');
  const dateISO = date || new Date().toISOString().slice(0, 10);
  if (!e.fee) e.fee = { total: 0, installments: 1, receipts: [] };
  e.fee.receipts.push({ id: store.id(), date: dateISO, amount: amt, note: note || '' });
  if (affectCashflow) {
    d.transactions.push({
      id: store.id(), type: 'income', description: 'Honorarios evento ' + e.name,
      category: 'Eventos', amount: amt, dateISO, month: fin.monthKey(dateISO),
      source: 'evento', createdAt: new Date().toISOString()
    });
  }
  store.scheduleBackup();
  ok(res, { event: e, computed: evmod.computeEvent(e) });
});
function round2n(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

// ---------- Dashboard / Projecao / Relatorios ----------
app.get('/api/dashboard', (req, res) => {
  const data = store.getData();
  const dash = proj.dashboard(data);
  dash.projects = data.projects.map(projmod.projectSummary);
  ok(res, dash);
});
app.get('/api/projection', (req, res) => {
  const count = Math.min(48, Math.max(1, Number(req.query.count) || 12));
  ok(res, proj.monthlyProjection(store.getData(), count));
});
app.get('/api/reports', (req, res) => {
  const months = Math.min(24, Math.max(1, Number(req.query.months) || 6));
  ok(res, proj.reports(store.getData(), months));
});

// ---------- Calendario ----------
app.get('/api/calendar', (req, res) => {
  const d = store.getData();
  const mk = req.query.month || proj.currentMonthKey();
  const events = [];
  d.recurrings.forEach(r => {
    if (r.active === false) return;
    if (r.startMonth && mk < r.startMonth) return;
    if (r.endMonth && mk > r.endMonth) return;
    events.push({ day: r.dayOfMonth, type: r.type, kind: 'recorrente', label: r.description, amount: r.amount });
  });
  d.transactions.forEach(t => {
    if (t.month === mk) events.push({ day: Number(t.dateISO.slice(8, 10)), type: t.type, kind: 'lancamento', label: t.description, amount: t.amount });
  });
  d.installments.forEach(inst => {
    inst.items.forEach(it => {
      if (it.month === mk) events.push({ day: Number(it.dueISO.slice(8, 10)), type: 'expense', kind: 'fatura', label: `${inst.description} (${it.number}/${inst.numInstallments})`, amount: it.amount });
    });
  });
  d.loans.forEach(l => {
    l.items.forEach(it => {
      if (it.month === mk) events.push({ day: Number(it.dueISO.slice(8, 10)), type: 'income', kind: 'a receber', label: `${l.person}: ${l.description}`, amount: it.amount, settled: it.settled });
    });
  });
  events.sort((a, b) => a.day - b.day);
  ok(res, { month: mk, events });
});

// ---------- Simulador de impacto ----------
app.post('/api/simulate', (req, res) => {
  const d = store.getData();
  const { cardId, totalAmount, numInstallments, purchaseDate } = req.body || {};
  const card = d.cards.find(c => c.id === cardId);
  if (!card) return bad(res, 'Selecione um cartao valido.');
  if (!totalAmount || !numInstallments) return bad(res, 'Informe valor e parcelas.');
  const before = proj.monthlyProjection(d, 12);
  // clona dados e adiciona a compra simulada
  const clone = JSON.parse(JSON.stringify(d));
  const items = fin.generateCardInstallments(purchaseDate || new Date().toISOString().slice(0, 10), card.closingDay, card.dueDay, Number(totalAmount), Number(numInstallments));
  clone.installments.push({ id: 'sim', cardId, description: 'SIMULACAO', category: 'Simulacao', totalAmount: Number(totalAmount), numInstallments: Number(numInstallments), items });
  const after = proj.monthlyProjection(clone, 12);
  const cardBefore = proj.cardsStatus(d).find(c => c.id === cardId);
  const cardAfter = proj.cardsStatus(clone).find(c => c.id === cardId);
  const perInstallment = fin.splitAmount(Number(totalAmount), Number(numInstallments))[0];
  ok(res, { before, after, perInstallment, cardBefore, cardAfter, worstMonth: after.reduce((w, m) => m.balance < w.balance ? m : w, after[0]) });
});

// ---------- Importacao ----------
app.post('/api/import/parse', upload.single('file'), async (req, res) => {
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  const name = (req.file.originalname || '').toLowerCase();
  try {
    let items = [];
    if (name.endsWith('.csv')) items = importer.parseCSV(req.file.buffer.toString('utf8'));
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) items = importer.parseExcel(req.file.buffer);
    else if (name.endsWith('.pdf')) items = await importer.parsePDF(req.file.buffer);
    else return bad(res, 'Formato nao suportado. Use CSV, XLSX ou PDF.');
    // marca possiveis duplicatas ja cadastradas
    const dd = store.getData();
    const norm = x => String(x || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
    const existing = [];
    dd.installments.forEach(inst => inst.items.forEach(it => existing.push({ n: norm(inst.description), a: it.amount, m: it.month })));
    dd.transactions.forEach(t => existing.push({ n: norm(t.description), a: Number(t.amount), m: t.month }));
    const mnum = mm => { const [y, o] = mm.split('-').map(Number); return y * 12 + o; };
    items.forEach(it => {
      const n = norm(it.description), m = (it.date || '').slice(0, 7);
      it.duplicate = n.length > 2 && existing.some(e => Math.abs(mnum(e.m) - mnum(m)) <= 1 && Math.abs(e.a - it.amount) < 0.02 && (e.n.includes(n) || n.includes(e.n)));
    });
    ok(res, { count: items.length, items, filename: req.file.originalname });
  } catch (e) {
    console.error(e);
    bad(res, 'Falha ao processar arquivo: ' + e.message);
  }
});
app.post('/api/import/commit', (req, res) => {
  const d = store.getData();
  const { cardId, items } = req.body || {};
  if (!Array.isArray(items)) return bad(res, 'Itens invalidos.');
  const card = d.cards.find(c => c.id === cardId);
  let created = 0;
  for (const it of items) {
    if (it.skip) continue;
    if (card && it.type !== 'income') {
      if (it.installment && it.installment.total > 1) {
        // reconstroi o cronograma completo da parcela detectada (ex: 3/10)
        const n = it.installment.total;
        const total = Math.round(Number(it.amount) * n * 100) / 100;
        const gen = fin.generateCardInstallments(it.date, card.closingDay, card.dueDay, total, n);
        const today = new Date().toISOString().slice(0, 10);
        gen.forEach(g => { if (g.number < it.installment.current) { g.paid = true; g.paidDate = today; } });
        d.installments.push({
          id: store.id(), cardId, description: it.description, category: it.category || 'Outros',
          purchaseDate: it.date, totalAmount: total, numInstallments: n, items: gen,
          source: 'import', createdAt: new Date().toISOString()
        });
      } else {
        const amount = Number(it.amount);
        const gen = fin.generateCardInstallments(it.date, card.closingDay, card.dueDay, amount, 1);
        d.installments.push({
          id: store.id(), cardId, description: it.description, category: it.category || 'Outros',
          purchaseDate: it.date, totalAmount: amount, numInstallments: 1, items: gen,
          source: 'import', createdAt: new Date().toISOString()
        });
      }
    } else {
      d.transactions.push({
        id: store.id(), type: it.type === 'income' ? 'income' : 'expense',
        description: it.description, category: it.category || 'Outros', amount: Number(it.amount),
        dateISO: it.date, month: fin.monthKey(it.date), source: 'import', createdAt: new Date().toISOString()
      });
    }
    created++;
  }
  store.saveWithBackup();
  ok(res, { created });
});

// ---------- Perfis Inteligentes de Eventos ----------
const epmod = require('./event-profiles');

// Garante que os perfis padrão e configurações globais existam na primeira execução
function ensureDefaultProfiles() {
  const d = store.getData();
  if (!d.eventProfiles) d.eventProfiles = [];
  if (!d.eventModels) d.eventModels = [];
  if (d.eventProfiles.length === 0) {
    d.eventProfiles = epmod.defaultProfiles();
    store.scheduleBackup();
  }
  if (!d.eventGlobalSettings) {
    d.eventGlobalSettings = epmod.defaultGlobalSettings();
    store.scheduleBackup();
  }
}

// Listar perfis
app.get('/api/event-profiles', auth, (req, res) => {
  ensureDefaultProfiles();
  ok(res, store.getData().eventProfiles);
});

// Criar perfil
app.post('/api/event-profiles', auth, (req, res) => {
  ensureDefaultProfiles();
  const d = store.getData();
  const body = req.body || {};
  const profile = Object.assign({
    id: store.id(), name: 'Novo perfil', isDefault: false, active: true,
    color: '#B9502C', icon: '🎉',
    food: [], drinks: [], decor: [], materials: [], team: [],
    checklist: [], schedule: []
  }, body, { id: store.id(), createdAt: new Date().toISOString() });
  d.eventProfiles.push(profile);
  store.scheduleBackup();
  ok(res, profile);
});

// Atualizar perfil
app.put('/api/event-profiles/:id', auth, (req, res) => {
  const d = store.getData();
  const i = d.eventProfiles.findIndex(p => p.id === req.params.id);
  if (i < 0) return bad(res, 'Perfil nao encontrado', 404);
  d.eventProfiles[i] = Object.assign({}, d.eventProfiles[i], req.body || {}, { id: d.eventProfiles[i].id, createdAt: d.eventProfiles[i].createdAt });
  store.scheduleBackup();
  ok(res, d.eventProfiles[i]);
});

// Excluir perfil
app.delete('/api/event-profiles/:id', auth, (req, res) => {
  const d = store.getData();
  d.eventProfiles = d.eventProfiles.filter(p => p.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});

// Duplicar perfil
app.post('/api/event-profiles/:id/duplicate', auth, (req, res) => {
  const d = store.getData();
  const src = d.eventProfiles.find(p => p.id === req.params.id);
  if (!src) return bad(res, 'Perfil nao encontrado', 404);
  const clone = JSON.parse(JSON.stringify(src));
  clone.id = store.id();
  clone.name = src.name + ' (cópia)';
  clone.isDefault = false;
  clone.createdAt = new Date().toISOString();
  // Regenera IDs dos itens
  ['food','drinks','decor','materials','team','checklist','schedule'].forEach(k => {
    if (Array.isArray(clone[k])) clone[k].forEach(item => { item.id = store.id(); });
  });
  d.eventProfiles.push(clone);
  store.scheduleBackup();
  ok(res, clone);
});

// Calcular sugestões para um evento com base no perfil
app.get('/api/event-profiles/:id/suggest', auth, (req, res) => {
  const d = store.getData();
  const profile = d.eventProfiles.find(p => p.id === req.params.id);
  if (!profile) return bad(res, 'Perfil nao encontrado', 404);
  const adults = Number(req.query.adults) || 0;
  const children59 = Number(req.query.children59) || Number(req.query.children) || 0;
  const childrenUnder5 = Number(req.query.childrenUnder5) || 0;
  const extraHours = Number(req.query.extraHours) || 0;
  const tables = Number(req.query.tables) || Math.ceil((adults + children59 + childrenUnder5) / ((profile.settings && profile.settings.peoplePerTable) || 10)) || 1;
  ok(res, epmod.calcSuggestions(profile, adults, children59, childrenUnder5, extraHours, tables));
});

// ---------- Importação de Planilha para Perfis Inteligentes ----------
// Mapeamento de chave da seção para o parser correto
const PROFILE_IMPORT_SECTIONS = {
  checklist:      (rows) => rows.map(row => ({
    id: store.id(), active: true,
    text: pickH(row, ['tarefa','task','item','descricao','description','nome','name']) || pickH(row, [normH(Object.keys(row)[0])]),
    category: pickH(row, ['categoria','category']) || '',
    daysBeforeEvent: Number(pickH(row, ['diasantes','daysbeforeevent','dias','days'])) || 30,
    priority: ({'alta':'Alta','high':'Alta','media':'Media','medium':'Media','baixa':'Baixa','low':'Baixa'})[normH(pickH(row, ['prioridade','priority','prio']))] || 'Media'
  })).filter(i => i.text),
  schedule:       (rows) => rows.map(row => ({
    id: store.id(), active: true,
    text: pickH(row, ['etapa','step','atividade','activity','item','descricao','nome','name']) || pickH(row, [normH(Object.keys(row)[0])]),
    category: pickH(row, ['categoria','category']) || '',
    daysBeforeEvent: Number(pickH(row, ['diasantes','daysbeforeevent','dias','days'])) || 30,
    time: pickH(row, ['hora','horario','time','inicio','start']) || '',
    duration: pickH(row, ['duracao','duration','tempo','minutos','minutes']) || '',
    responsible: pickH(row, ['responsavel','responsible']) || ''
  })).filter(i => i.text),
  decor:          (rows) => rows.map(row => ({
    id: store.id(), active: true,
    name: pickH(row, ['item','nome','name','descricao','description']) || pickH(row, [normH(Object.keys(row)[0])]),
    unit: pickH(row, ['unidade','unit','un']) || 'unidade',
    formulaType: 'fixed',
    formulaFactor: Number(pickH(row, ['quantidade','qty','qtd','quantity'])) || 1,
    formulaN: 1,
    notes: pickH(row, ['observacoes','obs','notes','nota']) || ''
  })).filter(i => i.name),
  materials:      (rows) => rows.map(row => ({
    id: store.id(), active: true,
    name: pickH(row, ['item','nome','name','descricao','description','material']) || pickH(row, [normH(Object.keys(row)[0])]),
    unit: pickH(row, ['unidade','unit','un']) || 'unidade',
    formulaType: 'fixed',
    formulaFactor: Number(pickH(row, ['quantidade','qty','qtd','quantity'])) || 1,
    formulaN: 1,
    notes: pickH(row, ['observacoes','obs','notes','nota']) || ''
  })).filter(i => i.name),
  defaultVendors: (rows) => rows.map(row => ({
    id: store.id(), active: true,
    name: pickH(row, ['fornecedor','vendor','nome','name','empresa','company']) || pickH(row, [normH(Object.keys(row)[0])]),
    type: pickH(row, ['tipo','type','categoria','category']) || 'Outros',
    notes: pickH(row, ['observacoes','obs','notes','nota']) || ''
  })).filter(i => i.name)
};

app.post('/api/event-profiles/:id/:section/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const profile = d.eventProfiles.find(p => p.id === req.params.id);
  if (!profile) return bad(res, 'Perfil nao encontrado', 404);
  const section = req.params.section;
  const parser = PROFILE_IMPORT_SECTIONS[section];
  if (!parser) return bad(res, 'Secao invalida para importacao', 400);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  let rows;
  try { rows = readSpreadsheet(req.file); } catch (err) { return bad(res, err.message); }
  const items = parser(rows);
  if (!Array.isArray(profile[section])) profile[section] = [];
  profile[section].push(...items);
  store.scheduleBackup();
  ok(res, { added: items.length, total: profile[section].length });
});

// ---------- Configurações Globais de Eventos ----------
app.get('/api/event-global-settings', auth, (req, res) => {
  ensureDefaultProfiles();
  ok(res, store.getData().eventGlobalSettings);
});

app.put('/api/event-global-settings', auth, (req, res) => {
  const d = store.getData();
  if (!d.eventGlobalSettings) d.eventGlobalSettings = epmod.defaultGlobalSettings();
  d.eventGlobalSettings = Object.assign({}, d.eventGlobalSettings, req.body || {}, { updatedAt: new Date().toISOString() });
  store.scheduleBackup();
  ok(res, d.eventGlobalSettings);
});

// CRUD dinâmico para sub-listas das configurações globais
// Suporta: ageGroups, tableTypes, units, categories, vendorTypes, teamTypes, statusOptions, priorities, formulaTypes
const GLOBAL_LISTS = ['ageGroups','tableTypes','units','categories','vendorTypes','teamTypes','statusOptions','priorities','formulaTypes'];

app.post('/api/event-global-settings/:list', auth, (req, res) => {
  const { list } = req.params;
  if (!GLOBAL_LISTS.includes(list)) return bad(res, 'Lista inválida', 400);
  const d = store.getData();
  if (!d.eventGlobalSettings) d.eventGlobalSettings = epmod.defaultGlobalSettings();
  if (!Array.isArray(d.eventGlobalSettings[list])) d.eventGlobalSettings[list] = [];
  const item = Object.assign({}, req.body || {}, { id: store.id() });
  d.eventGlobalSettings[list].push(item);
  d.eventGlobalSettings.updatedAt = new Date().toISOString();
  store.scheduleBackup();
  ok(res, item);
});

app.put('/api/event-global-settings/:list/:id', auth, (req, res) => {
  const { list, id } = req.params;
  if (!GLOBAL_LISTS.includes(list)) return bad(res, 'Lista inválida', 400);
  const d = store.getData();
  if (!d.eventGlobalSettings) d.eventGlobalSettings = epmod.defaultGlobalSettings();
  const arr = d.eventGlobalSettings[list] || [];
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) return bad(res, 'Item não encontrado', 404);
  arr[i] = Object.assign({}, arr[i], req.body || {}, { id });
  d.eventGlobalSettings.updatedAt = new Date().toISOString();
  store.scheduleBackup();
  ok(res, arr[i]);
});

app.delete('/api/event-global-settings/:list/:id', auth, (req, res) => {
  const { list, id } = req.params;
  if (!GLOBAL_LISTS.includes(list)) return bad(res, 'Lista inválida', 400);
  const d = store.getData();
  if (!d.eventGlobalSettings) d.eventGlobalSettings = epmod.defaultGlobalSettings();
  d.eventGlobalSettings[list] = (d.eventGlobalSettings[list] || []).filter(x => x.id !== id);
  d.eventGlobalSettings.updatedAt = new Date().toISOString();
  store.scheduleBackup();
  ok(res, { success: true });
});

// ---------- Biblioteca de Modelos ----------
app.get('/api/event-models', auth, (req, res) => {
  const d = store.getData();
  ok(res, d.eventModels || []);
});

// Salvar modelo a partir de um evento
app.post('/api/event-models', auth, (req, res) => {
  const d = store.getData();
  if (!d.eventModels) d.eventModels = [];
  const body = req.body || {};
  const model = {
    id: store.id(),
    name: body.name || 'Modelo sem nome',
    description: body.description || '',
    profileId: body.profileId || null,
    food: body.food || [],
    drinks: body.drinks || [],
    decor: body.decor || [],
    materials: body.materials || [],
    team: body.team || [],
    checklist: body.checklist || [],
    schedule: body.schedule || [],
    createdAt: new Date().toISOString()
  };
  d.eventModels.push(model);
  store.scheduleBackup();
  ok(res, model);
});

// Atualizar modelo
app.put('/api/event-models/:id', auth, (req, res) => {
  const d = store.getData();
  const i = (d.eventModels || []).findIndex(m => m.id === req.params.id);
  if (i < 0) return bad(res, 'Modelo nao encontrado', 404);
  d.eventModels[i] = Object.assign({}, d.eventModels[i], req.body || {}, { id: d.eventModels[i].id, createdAt: d.eventModels[i].createdAt });
  store.scheduleBackup();
  ok(res, d.eventModels[i]);
});

// Excluir modelo
app.delete('/api/event-models/:id', auth, (req, res) => {
  const d = store.getData();
  d.eventModels = (d.eventModels || []).filter(m => m.id !== req.params.id);
  store.scheduleBackup();
  ok(res, { success: true });
});

// Aplicar modelo a um evento (preenche as seções do evento)
app.post('/api/events/:id/apply-model', auth, (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const { modelId } = req.body || {};
  const model = (d.eventModels || []).find(m => m.id === modelId);
  if (!model) return bad(res, 'Modelo nao encontrado', 404);
  // Aplica os dados do modelo ao evento (sem sobrescrever campos base)
  const newId = () => store.id();
  if (model.food && model.food.length) e.planFood = model.food.map(i => Object.assign({}, i, { id: newId(), qty: 0, notes: i.notes || '' }));
  if (model.drinks && model.drinks.length) e.planDrinks = model.drinks.map(i => Object.assign({}, i, { id: newId(), qty: 0, notes: i.notes || '' }));
  if (model.decor && model.decor.length) e.planDecor = model.decor.map(i => Object.assign({}, i, { id: newId(), qty: 0, notes: i.notes || '' }));
  if (model.materials && model.materials.length) e.planMaterials = model.materials.map(i => Object.assign({}, i, { id: newId(), qty: 0, notes: i.notes || '' }));
  if (model.team && model.team.length) e.planTeam = model.team.map(i => Object.assign({}, i, { id: newId(), qty: 0, notes: i.notes || '' }));
  if (model.checklist && model.checklist.length) {
    const existing = e.checklist || [];
    const toAdd = model.checklist.map(i => ({ id: newId(), text: i.text, category: i.category || '', daysBeforeEvent: i.daysBeforeEvent || 0, status: 'Pendente', dueDate: '' }));
    e.checklist = [...existing, ...toAdd];
  }
  if (model.schedule && model.schedule.length) {
    e.schedule = model.schedule.map(i => ({ id: newId(), text: i.text, category: i.category || '', daysBeforeEvent: i.daysBeforeEvent || 0, status: 'Pendente', dueDate: '', done: false }));
  }
  store.scheduleBackup();
  ok(res, { event: e, computed: evmod.computeEvent(e) });
});

// Aplicar perfil a um evento (preenche com sugestões calculadas + snapshot)
app.post('/api/events/:id/apply-profile', auth, (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const { profileId } = req.body || {};
  const profile = (d.eventProfiles || []).find(p => p.id === profileId);
  if (!profile) return bad(res, 'Perfil nao encontrado', 404);
  const c = evmod.computeEvent(e);
  const adults = c.adults || 0;
  const children59 = c.kidsUnder10 || 0;
  const childrenUnder5 = 0;
  const tables = Math.ceil((adults + children59) / ((profile.settings && profile.settings.peoplePerTable) || 10)) || 1;
  const suggestions = epmod.calcSuggestions(profile, adults, children59, childrenUnder5, 0, tables);
  const newId = () => store.id();
  // Salva snapshot do perfil no evento (independente de futuras alterações no perfil)
  e.profileId = profileId;
  e.profileSnapshot = epmod.snapshotProfile(profile, () => store.id());
  e.planFood = suggestions.food.map(i => ({ id: newId(), name: i.name, unit: i.unit, perAdult: i.perAdult, perChild59: i.perChild59, perChildUnder5: i.perChildUnder5, suggestedTotal: i.suggestedTotal, qty: i.suggestedTotal, notes: i.notes || '' }));
  e.planDrinks = suggestions.drinks.map(i => ({ id: newId(), name: i.name, unit: i.unit, perAdult: i.perAdult, perChild59: i.perChild59, perChildUnder5: i.perChildUnder5, suggestedTotal: i.suggestedTotal, qty: i.suggestedTotal, notes: i.notes || '' }));
  e.planDecor = suggestions.decor.map(i => ({ id: newId(), name: i.name, unit: i.unit, formulaType: i.formulaType, formulaFactor: i.formulaFactor, formulaN: i.formulaN, suggestedQty: i.suggestedQty, qty: i.suggestedQty, notes: i.notes || '' }));
  e.planMaterials = suggestions.materials.map(i => ({ id: newId(), name: i.name, unit: i.unit, category: i.category, formulaType: i.formulaType, formulaFactor: i.formulaFactor, formulaN: i.formulaN, suggestedQty: i.suggestedQty, qty: i.suggestedQty, notes: i.notes || '' }));
  e.planTeam = suggestions.team.map(i => ({ id: newId(), name: i.name, formulaType: i.formulaType, formulaFactor: i.formulaFactor, formulaN: i.formulaN, suggestedQty: i.suggestedQty, qty: i.suggestedQty, defaultValue: i.defaultValue || 0, notes: i.notes || '' }));
  if (profile.checklist && profile.checklist.length && (!e.checklist || e.checklist.length === 0)) {
    e.checklist = profile.checklist.map(i => ({ id: newId(), text: i.text, category: i.category || '', daysBeforeEvent: i.daysBeforeEvent || 0, priority: i.priority || 'Média', status: 'Pendente', dueDate: '' }));
  }
  if (profile.schedule && profile.schedule.length) {
    e.schedule = profile.schedule.map(i => ({ id: newId(), text: i.text, category: i.category || '', daysBeforeEvent: i.daysBeforeEvent || 0, status: 'Pendente', dueDate: '', done: false }));
  }
  if (profile.defaultVendors && profile.defaultVendors.length && (!e.vendors || e.vendors.length === 0)) {
    e.vendors = profile.defaultVendors.map(v => ({ id: newId(), name: v.name, type: v.type, notes: v.notes || '', status: 'Planejamento', value: 0 }));
  }
  if (profile.budget && profile.budget.length && (!e.budgetItems || e.budgetItems.length === 0)) {
    e.budgetItems = profile.budget.map(b => ({ id: newId(), category: b.category, estimatedValue: b.estimatedValue || 0, actualValue: 0, notes: b.notes || '' }));
  }
  store.scheduleBackup();
  ok(res, { event: e, computed: evmod.computeEvent(e) });
});

// Atualização manual seletiva de perfil (escolher quais seções importar)
app.post('/api/events/:id/apply-profile-selective', auth, (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const { profileId, sections } = req.body || {};
  const profile = (d.eventProfiles || []).find(p => p.id === profileId);
  if (!profile) return bad(res, 'Perfil nao encontrado', 404);
  const secs = Array.isArray(sections) ? sections : [];
  const c = evmod.computeEvent(e);
  const adults = c.adults || 0;
  const children59 = c.kidsUnder10 || 0;
  const childrenUnder5 = 0;
  const tables = Math.ceil((adults + children59) / ((profile.settings && profile.settings.peoplePerTable) || 10)) || 1;
  const suggestions = epmod.calcSuggestions(profile, adults, children59, childrenUnder5, 0, tables);
  const newId = () => store.id();
  if (secs.includes('food')) e.planFood = suggestions.food.map(i => ({ id: newId(), name: i.name, unit: i.unit, perAdult: i.perAdult, perChild59: i.perChild59, perChildUnder5: i.perChildUnder5, suggestedTotal: i.suggestedTotal, qty: i.suggestedTotal, notes: i.notes || '' }));
  if (secs.includes('drinks')) e.planDrinks = suggestions.drinks.map(i => ({ id: newId(), name: i.name, unit: i.unit, perAdult: i.perAdult, perChild59: i.perChild59, perChildUnder5: i.perChildUnder5, suggestedTotal: i.suggestedTotal, qty: i.suggestedTotal, notes: i.notes || '' }));
  if (secs.includes('decor')) e.planDecor = suggestions.decor.map(i => ({ id: newId(), name: i.name, unit: i.unit, formulaType: i.formulaType, formulaFactor: i.formulaFactor, formulaN: i.formulaN, suggestedQty: i.suggestedQty, qty: i.suggestedQty, notes: i.notes || '' }));
  if (secs.includes('materials')) e.planMaterials = suggestions.materials.map(i => ({ id: newId(), name: i.name, unit: i.unit, category: i.category, formulaType: i.formulaType, formulaFactor: i.formulaFactor, formulaN: i.formulaN, suggestedQty: i.suggestedQty, qty: i.suggestedQty, notes: i.notes || '' }));
  if (secs.includes('team')) e.planTeam = suggestions.team.map(i => ({ id: newId(), name: i.name, formulaType: i.formulaType, formulaFactor: i.formulaFactor, formulaN: i.formulaN, suggestedQty: i.suggestedQty, qty: i.suggestedQty, defaultValue: i.defaultValue || 0, notes: i.notes || '' }));
  if (secs.includes('checklist') && profile.checklist && profile.checklist.length) {
    e.checklist = profile.checklist.map(i => ({ id: newId(), text: i.text, category: i.category || '', daysBeforeEvent: i.daysBeforeEvent || 0, priority: i.priority || 'Média', status: 'Pendente', dueDate: '' }));
  }
  if (secs.includes('schedule') && profile.schedule && profile.schedule.length) {
    e.schedule = profile.schedule.map(i => ({ id: newId(), text: i.text, category: i.category || '', daysBeforeEvent: i.daysBeforeEvent || 0, status: 'Pendente', dueDate: '', done: false }));
  }
  if (secs.includes('vendors') && profile.defaultVendors && profile.defaultVendors.length) {
    e.vendors = profile.defaultVendors.map(v => ({ id: newId(), name: v.name, type: v.type, notes: v.notes || '', status: 'Planejamento', value: 0 }));
  }
  if (secs.includes('budget') && profile.budget && profile.budget.length) {
    e.budgetItems = profile.budget.map(b => ({ id: newId(), category: b.category, estimatedValue: b.estimatedValue || 0, actualValue: 0, notes: b.notes || '' }));
  }
  if (secs.includes('settings') && profile.settings) {
    e.profileSettings = Object.assign({}, profile.settings);
  }
  // Atualiza o snapshot do perfil
  e.profileId = profileId;
  e.profileSnapshot = epmod.snapshotProfile(profile, () => store.id());
  store.scheduleBackup();
  ok(res, { event: e, computed: evmod.computeEvent(e) });
});

// ---------- Relatorio PDF do Evento ----------
app.get('/api/events/:id/report', auth, async (req, res) => {
  const e = store.getData().events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const c = evmod.computeEvent(e);
  try {
    const pdf = await pdfgen.buildEventReportPdf(e, c);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${e.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Erro ao gerar relatorio PDF:', err.message);
    bad(res, 'Erro ao gerar PDF: ' + err.message, 500);
  }
});

// ---------- Relatorio do Cliente (Lista de Compras) ----------
app.get('/api/events/:id/client-report', auth, async (req, res) => {
  const e = store.getData().events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  const c = evmod.computeEvent(e);
  try {
    const pdf = await pdfgen.buildClientShoppingPdf(e, c);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lista-compras-${e.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Erro ao gerar lista PDF:', err.message);
    bad(res, 'Erro ao gerar PDF: ' + err.message, 500);
  }
});

// ---------- Importacao de Convidados ----------
app.post('/api/events/:id/guests/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  const name = (req.file.originalname || '').toLowerCase();
  const XLSX = require('xlsx');
  let rows = [];
  try {
    if (name.endsWith('.csv')) {
      const text = req.file.buffer.toString('utf8');
      const wb = XLSX.read(text, { type: 'string' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    } else {
      return bad(res, 'Formato nao suportado. Use CSV ou XLSX.');
    }
  } catch (err) {
    return bad(res, 'Falha ao ler arquivo: ' + err.message);
  }
  // Normaliza cabecalhos: aceita variantes em pt/en
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const pick = (row, keys) => { for (const k of Object.keys(row)) { if (keys.includes(norm(k))) return String(row[k] || '').trim(); } return ''; };
  let added = 0;
  if (!e.guests) e.guests = [];
  rows.forEach(row => {
    const gname = pick(row, ['nome', 'name', 'convidado', 'guest']) || pick(row, Object.keys(row).slice(0, 1));
    if (!gname) return;
    const group = pick(row, ['grupo', 'group', 'familia', 'family']);
    const contact = pick(row, ['contato', 'contact', 'telefone', 'phone', 'email', 'whatsapp']);
    const status = pick(row, ['status', 'confirmacao', 'confirmation', 'rsvp']);
    const age = pick(row, ['idade', 'age', 'anos']);
    const statusMap = { confirmado: 'Confirmado', confirmed: 'Confirmado', sim: 'Confirmado', yes: 'Confirmado', recusado: 'Recusado', refused: 'Recusado', nao: 'Recusado', no: 'Recusado' };
    const statusNorm = statusMap[norm(status)] || 'Pendente';
    e.guests.push({ id: store.id(), name: gname, group: group || '', contact: contact || '', status: statusNorm, age: age !== '' ? age : '', companions: 0 });
    added++;
  });
  store.scheduleBackup();
  ok(res, { added, total: e.guests.length });
});

// ---------- Importacao Generica de Planilha para Eventos ----------
// Helper: le CSV ou XLSX e retorna array de rows
function readSpreadsheet(file) {
  const XLSX = require('xlsx');
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.csv')) {
    const text = file.buffer.toString('utf8');
    const wb = XLSX.read(text, { type: 'string' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  }
  throw new Error('Formato nao suportado. Use CSV ou XLSX.');
}
const normH = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const pickH = (row, keys) => { for (const k of Object.keys(row)) { if (keys.includes(normH(k))) return String(row[k] || '').trim(); } return ''; };

// Modelo de planilha para download
app.get('/api/events/template/:section', (req, res) => {
  const XLSX = require('xlsx');
  const section = req.params.section;
  const templates = {
    checklist: {
      filename: 'modelo-checklist.xlsx',
      headers: ['Tarefa', 'Prazo (AAAA-MM-DD)', 'Status (Pendente/Concluido)', 'Prioridade (Alta/Media/Baixa)'],
      sample: [['Confirmar buffet', '2026-09-01', 'Pendente', 'Alta'], ['Enviar convites', '2026-08-15', 'Pendente', 'Media']]
    },
    cronograma: {
      filename: 'modelo-cronograma.xlsx',
      headers: ['Etapa', 'Hora (HH:MM)', 'Duracao (min)', 'Responsavel', 'Observacoes'],
      sample: [['Chegada dos convidados', '19:00', '30', 'Equipe', ''], ['Entrada da aniversariante', '20:00', '15', 'Cerimonialista', '']]
    },
    decoracao: {
      filename: 'modelo-decoracao.xlsx',
      headers: ['Item', 'Unidade', 'Quantidade', 'Observacoes'],
      sample: [['Baloes', 'unidade', '100', 'Rosa e dourado'], ['Centro de mesa', 'unidade', '15', '1 por mesa']]
    },
    materiais: {
      filename: 'modelo-materiais.xlsx',
      headers: ['Item', 'Unidade', 'Quantidade', 'Observacoes'],
      sample: [['Guardanapos', 'pacote', '10', ''], ['Pratos descartaveis', 'unidade', '100', '']]
    },
    fornecedores: {
      filename: 'modelo-fornecedores.xlsx',
      headers: ['Fornecedor', 'Categoria', 'Contato', 'Valor Orcado (R$)', 'Valor Fechado (R$)', 'Ja Pago (R$)', 'Vencimento (AAAA-MM-DD)', 'Status (Orcando/Fechado/Pago)', 'Observacoes'],
      sample: [['Buffet Estrela', 'Alimentacao', '(11) 99999-0001', '8000', '8000', '4000', '2026-09-01', 'Fechado', ''], ['DJ Som & Luz', 'Musica/DJ', '(11) 99999-0002', '3000', '2800', '0', '', 'Orcando', '']]
    }
  };
  const tpl = templates[section];
  if (!tpl) return bad(res, 'Secao invalida', 404);
  const ws = XLSX.utils.aoa_to_sheet([tpl.headers, ...tpl.sample]);
  // Largura das colunas
  ws['!cols'] = tpl.headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
  res.send(buf);
});

// Importar Checklist
app.post('/api/events/:id/checklist/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  let rows;
  try { rows = readSpreadsheet(req.file); } catch (err) { return bad(res, err.message); }
  if (!e.checklist) e.checklist = [];
  let added = 0;
  rows.forEach(row => {
    const text = pickH(row, ['tarefa', 'task', 'item', 'descricao', 'description', 'nome', 'name']) || pickH(row, [normH(Object.keys(row)[0])]);
    if (!text) return;
    const dueDate = pickH(row, ['prazo', 'data', 'date', 'duedate', 'vencimento', 'deadline']);
    const statusRaw = normH(pickH(row, ['status', 'situacao']));
    const statusMap = { concluido: 'Concluido', done: 'Concluido', completo: 'Concluido', concluida: 'Concluido', sim: 'Concluido', yes: 'Concluido' };
    const status = statusMap[statusRaw] || 'Pendente';
    const prioRaw = normH(pickH(row, ['prioridade', 'priority', 'prio']));
    const prioMap = { alta: 'Alta', high: 'Alta', media: 'Media', medium: 'Media', baixa: 'Baixa', low: 'Baixa' };
    const priority = prioMap[prioRaw] || 'Media';
    e.checklist.push({ id: store.id(), text, dueDate: dueDate || '', status, priority });
    added++;
  });
  store.scheduleBackup();
  ok(res, { added, total: e.checklist.length });
});

// Importar Cronograma
app.post('/api/events/:id/schedule/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  let rows;
  try { rows = readSpreadsheet(req.file); } catch (err) { return bad(res, err.message); }
  if (!e.schedule) e.schedule = [];
  let added = 0;
  rows.forEach(row => {
    const text = pickH(row, ['etapa', 'step', 'atividade', 'activity', 'item', 'descricao', 'nome', 'name']) || pickH(row, [normH(Object.keys(row)[0])]);
    if (!text) return;
    const time = pickH(row, ['hora', 'horario', 'time', 'inicio', 'start']);
    const duration = pickH(row, ['duracao', 'duration', 'tempo', 'minutos', 'minutes']);
    const responsible = pickH(row, ['responsavel', 'responsible', 'responsavel']);
    const notes = pickH(row, ['observacoes', 'obs', 'notes', 'nota']);
    e.schedule.push({ id: store.id(), text, time: time || '', duration: duration || '', responsible: responsible || '', notes: notes || '' });
    added++;
  });
  store.scheduleBackup();
  ok(res, { added, total: e.schedule.length });
});

// Importar Decoracao
app.post('/api/events/:id/decor/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  let rows;
  try { rows = readSpreadsheet(req.file); } catch (err) { return bad(res, err.message); }
  if (!e.planDecor) e.planDecor = [];
  let added = 0;
  rows.forEach(row => {
    const name = pickH(row, ['item', 'nome', 'name', 'descricao', 'description']) || pickH(row, [normH(Object.keys(row)[0])]);
    if (!name) return;
    const unit = pickH(row, ['unidade', 'unit', 'un']) || 'unidade';
    const qty = Number(pickH(row, ['quantidade', 'qty', 'qtd', 'quantity', 'qtde'])) || 0;
    const notes = pickH(row, ['observacoes', 'obs', 'notes', 'nota']);
    e.planDecor.push({ id: store.id(), name, unit, qty, notes: notes || '' });
    added++;
  });
  store.scheduleBackup();
  ok(res, { added, total: e.planDecor.length });
});

// Importar Materiais
app.post('/api/events/:id/materials/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  let rows;
  try { rows = readSpreadsheet(req.file); } catch (err) { return bad(res, err.message); }
  if (!e.planMaterials) e.planMaterials = [];
  let added = 0;
  rows.forEach(row => {
    const name = pickH(row, ['item', 'nome', 'name', 'descricao', 'description', 'material']) || pickH(row, [normH(Object.keys(row)[0])]);
    if (!name) return;
    const unit = pickH(row, ['unidade', 'unit', 'un']) || 'unidade';
    const qty = Number(pickH(row, ['quantidade', 'qty', 'qtd', 'quantity', 'qtde'])) || 0;
    const notes = pickH(row, ['observacoes', 'obs', 'notes', 'nota']);
    e.planMaterials.push({ id: store.id(), name, unit, qty, notes: notes || '' });
    added++;
  });
  store.scheduleBackup();
  ok(res, { added, total: e.planMaterials.length });
});

// Importar Fornecedores
app.post('/api/events/:id/vendors/import', auth, upload.single('file'), (req, res) => {
  const d = store.getData();
  const e = d.events.find(x => x.id === req.params.id);
  if (!e) return bad(res, 'Evento nao encontrado', 404);
  if (!req.file) return bad(res, 'Nenhum arquivo enviado.');
  let rows;
  try { rows = readSpreadsheet(req.file); } catch (err) { return bad(res, err.message); }
  if (!e.vendors) e.vendors = [];
  let added = 0;
  rows.forEach(row => {
    const name = pickH(row, ['fornecedor', 'vendor', 'nome', 'name', 'empresa', 'company']) || pickH(row, [normH(Object.keys(row)[0])]);
    if (!name) return;
    const category = pickH(row, ['categoria', 'category', 'tipo', 'type']) || 'Outros';
    const contact = pickH(row, ['contato', 'contact', 'telefone', 'phone', 'email', 'whatsapp']);
    const quoted = Number(pickH(row, ['orcado', 'quoted', 'valororcado', 'orcamento', 'budget', 'valor'])) || 0;
    const agreed = Number(pickH(row, ['fechado', 'agreed', 'valorfechado', 'contratado'])) || quoted;
    const paid = Number(pickH(row, ['pago', 'paid', 'japago', 'pagamento'])) || 0;
    const dueDate = pickH(row, ['vencimento', 'duedate', 'prazo', 'datapagamento']);
    const statusRaw = normH(pickH(row, ['status', 'situacao']));
    const statusMap = { fechado: 'Fechado', closed: 'Fechado', pago: 'Pago', paid: 'Pago', orcando: 'Orcando' };
    const status = statusMap[statusRaw] || 'Orcando';
    const notes = pickH(row, ['observacoes', 'obs', 'notes', 'nota']);
    e.vendors.push({ id: store.id(), name, category, contact: contact || '', quoted, agreed, paid, dueDate: dueDate || '', status, notes: notes || '' });
    added++;
  });
  store.scheduleBackup();
  ok(res, { added, total: e.vendors.length });
});

// ---------- Backup / Exportacao ----------
app.get('/api/backup/export', (req, res) => {
  const d = store.getData();
  res.setHeader('Content-Disposition', 'attachment; filename="radar-backup.json"');
  res.json(d);
});
app.post('/api/backup/import', (req, res) => {
  try {
    const d = store.getData();
    const incoming = req.body || {};
    // preserva usuario atual se o backup nao tiver
    if (!incoming.user && d.user) incoming.user = d.user;
    store.replaceAll(incoming);
    ok(res, { success: true });
  } catch (e) {
    bad(res, 'Backup invalido.');
  }
});

// ---------- Frontend estatico ----------
const PUBLIC = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return bad(res, 'Rota nao encontrada', 404);
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

store.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Radar Financeiro rodando em http://localhost:${PORT}`);
    console.log(`  Backend de dados: ${store.backend === 'mongo' ? 'MongoDB (permanente)' : store.DATA_FILE}\n`);
  });
}).catch(e => { console.error('Falha ao iniciar o store:', e); process.exit(1); });
