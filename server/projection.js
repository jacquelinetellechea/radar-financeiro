/**
 * Motor de projecao financeira: consolida cartoes, parcelamentos, recorrentes,
 * emprestimos e lancamentos avulsos em fluxo de caixa mensal, dashboard e relatorios.
 */
const { monthKey, addMonthsToKey } = require('./finance');

function currentMonthKey() { return monthKey(new Date()); }

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/** Lista de meses YYYY-MM a partir de startKey (inclusive). */
function rangeMonths(startKey, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(addMonthsToKey(startKey, i));
  return out;
}

function recurringActiveInMonth(r, mk) {
  if (r.active === false) return false;
  if (r.startMonth && mk < r.startMonth) return false;
  if (r.endMonth && mk > r.endMonth) return false;
  return true;
}

/** Total da fatura de um cartao em um mes (soma das parcelas com vencimento naquele mes). */
function cardInvoiceForMonth(data, cardId, mk) {
  let total = 0;
  for (const inst of data.installments) {
    if (inst.cardId !== cardId) continue;
    for (const it of inst.items) {
      if (it.month === mk) total += it.amount;
    }
  }
  return round2(total);
}

/** Soma de todas as faturas (todos cartoes) em um mes. */
function allCardsInvoiceForMonth(data, mk) {
  let total = 0;
  for (const inst of data.installments) {
    for (const it of inst.items) if (it.month === mk) total += it.amount;
  }
  return round2(total);
}

/** Projecao mensal detalhada para N meses a partir do mes atual (ou startKey). */
function monthlyProjection(data, count = 12, startKey = currentMonthKey()) {
  const months = rangeMonths(startKey, count);
  let running = Number(data.settings.currentBalance || 0);
  const rows = months.map(mk => {
    let recurringIncome = 0, recurringExpense = 0;
    for (const r of data.recurrings) {
      if (!recurringActiveInMonth(r, mk)) continue;
      if (r.type === 'income') recurringIncome += Number(r.amount);
      else recurringExpense += Number(r.amount);
    }
    let oneoffIncome = 0, oneoffExpense = 0;
    for (const t of data.transactions) {
      if (t.month !== mk) continue;
      if (t.type === 'income') oneoffIncome += Number(t.amount);
      else oneoffExpense += Number(t.amount);
    }
    const cardsInvoice = allCardsInvoiceForMonth(data, mk);
    let loansToReceive = 0;
    for (const l of data.loans) {
      for (const it of l.items) if (it.month === mk) loansToReceive += it.amount;
    }
    let reimbursements = 0;
    for (const inst of data.installments) {
      for (const it of inst.items) if (it.month === mk) reimbursements += (it.reimburseAmount || 0);
    }
    const income = round2(recurringIncome + oneoffIncome + loansToReceive + reimbursements);
    const expense = round2(recurringExpense + oneoffExpense + cardsInvoice);
    const net = round2(income - expense);
    running = round2(running + net);
    return {
      month: mk,
      recurringIncome: round2(recurringIncome),
      recurringExpense: round2(recurringExpense),
      oneoffIncome: round2(oneoffIncome),
      oneoffExpense: round2(oneoffExpense),
      cardsInvoice,
      reimbursements: round2(reimbursements),
      cardsInvoiceNet: round2(cardsInvoice - reimbursements),
      loansToReceive: round2(loansToReceive),
      income, expense, net,
      balance: running,
      risk: running < 0
    };
  });
  return rows;
}

/** Situacao de cada cartao: limite disponivel, comprometido e proxima fatura. */
function cardsStatus(data) {
  const cm = currentMonthKey();
  const charges = data.cardCharges || [];
  return data.cards.map(card => {
    let committed = 0;   // parcelas nao pagas (limite comprometido)
    let nextInvoice = 0;
    const futureMonths = {};
    for (const inst of data.installments) {
      if (inst.cardId !== card.id) continue;
      for (const it of inst.items) {
        if (!it.paid) committed += it.amount;
        if (it.month === cm) nextInvoice += it.amount;
        if (it.month >= cm) futureMonths[it.month] = round2((futureMonths[it.month] || 0) + it.amount);
      }
    }
    // Soma encargos avulsos do mes atual
    for (const c of charges) {
      if (c.cardId !== card.id) continue;
      committed += c.amount;
      if (c.month === cm) nextInvoice += c.amount;
      if (c.month >= cm) futureMonths[c.month] = round2((futureMonths[c.month] || 0) + c.amount);
    }
    committed = round2(committed);
    return {
      id: card.id, name: card.name, bank: card.bank, color: card.color,
      limitTotal: Number(card.limitTotal), closingDay: card.closingDay, dueDay: card.dueDay,
      committed, available: round2(Number(card.limitTotal) - committed),
      nextInvoice: round2(nextInvoice),
      usagePct: card.limitTotal > 0 ? Math.min(100, round2((committed / card.limitTotal) * 100)) : 0,
      futureMonths
    };
  });
}

/** Emprestimos a terceiros consolidados. */
function loansStatus(data) {
  return data.loans.map(l => {
    let received = 0, pending = 0, overdue = 0, nextDue = null;
    const today = new Date().toISOString().slice(0, 10);
    for (const it of l.items) {
      if (it.settled) received += it.amount;
      else {
        pending += it.amount;
        if (it.dueISO < today) overdue += it.amount;
        if (!nextDue || it.dueISO < nextDue) nextDue = it.dueISO;
      }
    }
    return {
      id: l.id, person: l.person, description: l.description,
      total: round2(Number(l.totalAmount)), received: round2(received),
      pending: round2(pending), overdue: round2(overdue),
      numInstallments: l.numInstallments, method: l.method, cardId: l.cardId || null,
      nextDue, items: l.items
    };
  });
}

function buildAlerts(data) {
  const alerts = [];
  const cm = currentMonthKey();
  const today = new Date();
  const cards = cardsStatus(data);
  for (const c of cards) {
    if (c.usagePct >= 80) alerts.push({ level: 'high', text: `Cartao ${c.name}: ${c.usagePct}% do limite comprometido.` });
    else if (c.usagePct >= 60) alerts.push({ level: 'medium', text: `Cartao ${c.name}: ${c.usagePct}% do limite comprometido.` });
  }
  // faturas/contas vencendo em 7 dias
  const in7 = new Date(today.getTime() + 7 * 864e5).toISOString().slice(0, 10);
  const todayISO = today.toISOString().slice(0, 10);
  for (const inst of data.installments) {
    for (const it of inst.items) {
      if (!it.paid && it.dueISO >= todayISO && it.dueISO <= in7) {
        alerts.push({ level: 'medium', text: `Parcela ${it.number}/${inst.numInstallments} de "${inst.description}" vence em ${it.dueISO} (R$ ${it.amount.toFixed(2)}).` });
      }
    }
  }
  // emprestimos em atraso
  for (const l of loansStatus(data)) {
    if (l.overdue > 0) alerts.push({ level: 'high', text: `${l.person} tem R$ ${l.overdue.toFixed(2)} em parcelas atrasadas a receber.` });
  }
  // projecao com saldo negativo
  const proj = monthlyProjection(data, 12);
  const negative = proj.find(p => p.balance < 0);
  if (negative) alerts.push({ level: 'high', text: `Risco financeiro: saldo projetado fica negativo em ${negative.month} (R$ ${negative.balance.toFixed(2)}).` });
  // mes com parcela elevada (acima da media + 40%)
  const avg = proj.reduce((s, p) => s + p.cardsInvoice, 0) / (proj.length || 1);
  for (const p of proj) {
    if (avg > 0 && p.cardsInvoice > avg * 1.4) {
      alerts.push({ level: 'medium', text: `Faturas altas em ${p.month}: R$ ${p.cardsInvoice.toFixed(2)} (acima da media).` });
      break;
    }
  }
  return alerts;
}

function dashboard(data) {
  const cm = currentMonthKey();
  const proj = monthlyProjection(data, 12);
  const thisMonth = proj[0];
  const cards = cardsStatus(data);
  const recv = receivables(data);
  const totalCommittedFuture = round2(cards.reduce((s, c) => s + c.committed, 0));
  const loansPending = round2(recv.reduce((s, r) => s + r.pending, 0));
  const nextInvoicesTotal = round2(cards.reduce((s, c) => s + c.nextInvoice, 0));
  return {
    currentBalance: Number(data.settings.currentBalance || 0),
    month: cm,
    expectedIncome: thisMonth ? thisMonth.income : 0,
    expectedExpense: thisMonth ? thisMonth.expense : 0,
    projectedBalanceEndMonth: thisMonth ? thisMonth.balance : 0,
    nextInvoicesTotal,
    totalCommittedFuture,
    loansPending,
    reimbursementsMonth: thisMonth ? thisMonth.reimbursements : 0,
    cardsInvoiceNetMonth: thisMonth ? thisMonth.cardsInvoiceNet : 0,
    cards,
    alerts: buildAlerts(data),
    projection: proj
  };
}

/** Relatorios: gastos por categoria, cartoes mais usados, emprestimos etc. */
function reports(data, months = 6) {
  const cm = currentMonthKey();
  const start = addMonthsToKey(cm, -(months - 1));
  const byCategory = {};
  // parcelas por categoria (dentro da janela por mes de vencimento)
  for (const inst of data.installments) {
    for (const it of inst.items) {
      if (it.month >= start && it.month <= cm) {
        const cat = inst.category || 'Outros';
        byCategory[cat] = round2((byCategory[cat] || 0) + it.amount);
      }
    }
  }
  for (const t of data.transactions) {
    if (t.type === 'expense' && t.month >= start && t.month <= cm) {
      const cat = t.category || 'Outros';
      byCategory[cat] = round2((byCategory[cat] || 0) + Number(t.amount));
    }
  }
  for (const r of data.recurrings) {
    if (r.type !== 'expense') continue;
    // conta cada mes ativo na janela
    let m = start;
    for (let i = 0; i < months; i++) {
      if (recurringActiveInMonth(r, m)) {
        const cat = r.category || 'Recorrente';
        byCategory[cat] = round2((byCategory[cat] || 0) + Number(r.amount));
      }
      m = addMonthsToKey(m, 1);
    }
  }
  // cartoes mais usados
  const cardUsage = data.cards.map(c => {
    let total = 0;
    for (const inst of data.installments) {
      if (inst.cardId !== c.id) continue;
      total += inst.totalAmount;
    }
    return { name: c.name, total: round2(total) };
  }).sort((a, b) => b.total - a.total);
  const loans = loansStatus(data);
  return {
    months, start, end: cm,
    byCategory,
    cardUsage,
    loansLent: round2(loans.reduce((s, l) => s + l.total, 0)),
    loansReceived: round2(loans.reduce((s, l) => s + l.received, 0)),
    loansPending: round2(loans.reduce((s, l) => s + l.pending, 0)),
    cashflow: monthlyProjection(data, months)
  };
}

/** Consolida tudo que o usuario tem a receber: emprestimos + reembolsos de parcelas. */
function receivables(data) {
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  for (const l of loansStatus(data)) {
    out.push({ source: 'loan', id: l.id, person: l.person, description: l.description,
      total: l.total, received: l.received, pending: l.pending, overdue: l.overdue, nextDue: l.nextDue });
  }
  for (const inst of data.installments) {
    if (!inst.reimbursePerson) continue;
    const items = inst.items.filter(it => (it.reimburseAmount || 0) > 0);
    if (!items.length) continue;
    let total = 0, received = 0, pending = 0, overdue = 0, nextDue = null;
    for (const it of items) {
      total += it.reimburseAmount;
      if (it.reimburseReceived) received += it.reimburseAmount;
      else {
        pending += it.reimburseAmount;
        if (it.dueISO < today) overdue += it.reimburseAmount;
        if (!nextDue || it.dueISO < nextDue) nextDue = it.dueISO;
      }
    }
    out.push({ source: 'installment', id: inst.id, person: inst.reimbursePerson,
      description: inst.description, total: round2(total), received: round2(received),
      pending: round2(pending), overdue: round2(overdue), nextDue, cardLinked: true });
  }
  return out;
}

module.exports = {
  currentMonthKey, rangeMonths, monthlyProjection, cardsStatus,
  loansStatus, receivables, dashboard, reports, buildAlerts, round2, cardInvoiceForMonth
};
