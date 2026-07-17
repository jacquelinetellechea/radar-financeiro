/**
 * Modulo "Eventos": gestao de eventos proprios ou de clientes.
 * Cada evento e um objeto JSON autocontido (info + fornecedores + convidados +
 * checklist + honorarios do cliente).
 */
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function brl(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function blankEvent(id, name) {
  return {
    id, name: name || 'Novo evento', type: 'Festa',
    date: '', time: '', venue: '', address: '',
    status: 'Planejamento',
    owner: 'Meu',                 // 'Meu' | 'Cliente'
    clientName: '', clientContact: '',
    budget: 0, notes: '',
    vendors: [],                  // {id,name,category,contact,quoted,agreed,paid,dueDate,status,notes}
    guests: [],                   // {id,name,group,companions,contact,status}
    checklist: [],                // {id,text,dueDate,status}
    fee: { total: 0, installments: 1, receipts: [] }, // honorarios (evento de cliente): receipts {id,date,amount,note}
    ideas: [],                    // {id,type:'link'|'image'|'note',content,note}
    coverUrl: '', themeColor: '', // identidade visual do evento (banner + cor)
    createdAt: new Date().toISOString()
  };
}

function computeEvent(e) {
  const today = new Date(); const todayISO = today.toISOString().slice(0, 10);
  const vendors = e.vendors || [];
  const contracted = round2(vendors.reduce((s, v) => s + (Number(v.agreed) || 0), 0)); // apenas valor fechado
  const quoted = round2(vendors.reduce((s, v) => s + (Number(v.quoted) || 0), 0));
  const paid = round2(vendors.reduce((s, v) => s + (Number(v.paid) || 0), 0));
  const toPay = round2(Math.max(0, contracted - paid));
  const budget = Number(e.budget || 0);
  const budgetLeft = round2(budget - contracted);
  const overBudget = budget > 0 && contracted > budget;

  const guests = e.guests || [];
  const invitedPeople = guests.length; // cada convidado = 1 pessoa
  const confirmedPeople = guests.filter(g => g.status === 'Confirmado').length;
  const pendingGuests = guests.filter(g => !g.status || g.status === 'Pendente').length;
  const refusedGuests = guests.filter(g => g.status === 'Recusado').length;
  const ageOf = g => (g.age === '' || g.age == null) ? null : Number(g.age);
  const kidsUnder5 = guests.filter(g => { const a = ageOf(g); return a != null && a < 5; }).length;
  const kids5to9 = guests.filter(g => { const a = ageOf(g); return a != null && a >= 5 && a < 10; }).length;
  const kidsUnder10 = kidsUnder5 + kids5to9;
  const adults = guests.length - kidsUnder10; // sem idade ou 10+ = adulto

  const checklist = e.checklist || [];
  const checkDone = checklist.filter(i => i.status === 'Concluido').length;
  const checkPercent = checklist.length ? round2(checkDone / checklist.length * 100) : 0;
  const overdueTasks = checklist.filter(i => i.status !== 'Concluido' && i.dueDate && i.dueDate < todayISO).length;

  let daysLeft = null;
  if (e.date) daysLeft = Math.ceil((new Date(e.date + 'T00:00:00') - today) / 86400000);

  const fee = e.fee || { total: 0, receipts: [] };
  const feeTotal = Number(fee.total || 0);
  const feeReceived = round2((fee.receipts || []).reduce((s, r) => s + Number(r.amount || 0), 0));
  const feeToReceive = round2(Math.max(0, feeTotal - feeReceived));

  return {
    budget, quoted, contracted, paid, toPay, budgetLeft, overBudget,
    guestsTotal: guests.length, invitedPeople, confirmedPeople, pendingGuests, refusedGuests,
    kidsUnder5, kids5to9, kidsUnder10, adults,
    checkDone, checklistTotal: checklist.length, checkPercent, overdueTasks,
    daysLeft, feeTotal, feeReceived, feeToReceive
  };
}

function eventAlerts(e, c) {
  const a = []; const todayISO = new Date().toISOString().slice(0, 10);
  if (c.overBudget) a.push({ level: 'high', text: `Orcamento estourado: contratado ${brl(c.contracted)} contra orcamento de ${brl(c.budget)}.` });
  if (c.overdueTasks > 0) a.push({ level: 'high', text: `${c.overdueTasks} tarefa(s) do checklist em atraso.` });
  if (c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 30) a.push({ level: 'medium', text: `Faltam ${c.daysLeft} dias para o evento.` });
  (e.vendors || []).forEach(v => {
    const rest = (Number(v.agreed) || 0) - (Number(v.paid) || 0);
    if (rest > 0 && v.dueDate) {
      const d = Math.ceil((new Date(v.dueDate + 'T00:00:00') - new Date()) / 86400000);
      if (d >= 0 && d <= 10) a.push({ level: 'medium', text: `Pagamento de ${v.name} (${brl(rest)}) vence em ${d} dia(s).` });
      if (d < 0) a.push({ level: 'high', text: `Pagamento de ${v.name} (${brl(rest)}) esta atrasado.` });
    }
  });
  if (c.pendingGuests > 0 && c.daysLeft !== null && c.daysLeft <= 30)
    a.push({ level: 'medium', text: `${c.pendingGuests} convidado(s) ainda nao responderam.` });
  if (e.owner === 'Cliente' && c.feeToReceive > 0)
    a.push({ level: 'low', text: `Honorarios a receber do cliente: ${brl(c.feeToReceive)}.` });
  return a;
}

function eventSummary(e) {
  const c = computeEvent(e);
  return {
    id: e.id, name: e.name, type: e.type, date: e.date, venue: e.venue,
    status: e.status, owner: e.owner, clientName: e.clientName,
    budget: c.budget, contracted: c.contracted, paid: c.paid, toPay: c.toPay,
    confirmedPeople: c.confirmedPeople, guestsTotal: c.guestsTotal,
    checkPercent: c.checkPercent, daysLeft: c.daysLeft, overBudget: c.overBudget
  };
}

module.exports = { blankEvent, computeEvent, eventAlerts, eventSummary, round2 };
