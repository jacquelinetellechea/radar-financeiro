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

// ---------- Dashboard / Projecao / Relatorios ----------
app.get('/api/dashboard', (req, res) => ok(res, proj.dashboard(store.getData())));
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
