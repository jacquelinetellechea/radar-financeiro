/**
 * Modulo "Projeto de Vida": calculos de progresso, indicadores e alertas.
 * Cada projeto e um objeto JSON autocontido (info + fundo + compras + checklist +
 * cronograma + metas + inspiracao). Os calculos abaixo derivam os numeros exibidos.
 */
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function brl(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

/** Cria um projeto novo com estrutura padrao. */
function blankProject(id, name) {
  return {
    id, name: name || 'Novo projeto', description: '',
    priority: 'Media', status: 'Planejamento',
    startDate: new Date().toISOString().slice(0, 10),
    targetDate: '', targetAmount: 0,
    fund: { initial: 0, entries: [] },   // entries: {id,date,type:'aporte'|'resgate',amount,note}
    lifestyle: [],                        // {id,name,amount}
    shopping: [],                         // {id,name,category,priority,estimated,paid,store,dueDate,status,notes}
    checklist: [],                        // {id,text,status}
    timeline: [],                         // {id,year,text,done}
    goals: [],                            // {id,text,deadline,status,percent}
    inspiration: [],                      // {id,type:'link'|'image'|'note',content,note}
    createdAt: new Date().toISOString()
  };
}

/** Calcula todos os numeros derivados de um projeto. */
function computeProject(p) {
  const today = new Date();
  const fund = p.fund || { initial: 0, entries: [] };
  let aportes = 0, resgates = 0;
  (fund.entries || []).forEach(e => {
    if (e.type === 'resgate') resgates += Number(e.amount || 0);
    else aportes += Number(e.amount || 0);
  });
  const saldo = round2(Number(fund.initial || 0) + aportes - resgates);
  const target = Number(p.targetAmount || 0);
  const restante = round2(Math.max(0, target - saldo));
  const percent = target > 0 ? Math.min(100, round2(saldo / target * 100)) : 0;

  let daysLeft = null, monthsLeft = null;
  if (p.targetDate) {
    const t = new Date(p.targetDate + 'T00:00:00');
    daysLeft = Math.ceil((t - today) / 86400000);
    monthsLeft = Math.max(0, (t.getFullYear() - today.getFullYear()) * 12 + (t.getMonth() - today.getMonth()));
  }
  const monthlyNeeded = (monthsLeft && monthsLeft > 0) ? round2(restante / monthsLeft) : restante;

  const lifestyle = p.lifestyle || [];
  const lifestyleMonthly = round2(lifestyle.reduce((s, i) => s + Number(i.amount || 0), 0));
  const lifestyleAnnual = round2(lifestyleMonthly * 12);
  const recommendedIncome = round2(lifestyleMonthly / 0.7); // custos ~70% da renda liquida

  const shopping = p.shopping || [];
  const shopEstimated = round2(shopping.reduce((s, i) => s + Number(i.estimated || 0), 0));
  const shopPaid = round2(shopping.reduce((s, i) => s + Number(i.paid || 0), 0));
  const shopDone = shopping.filter(i => i.status === 'Concluido' || i.status === 'Comprado').length;
  const shopPending = shopping.length - shopDone;
  const shopPercent = shopping.length ? round2(shopDone / shopping.length * 100) : 0;

  const checklist = p.checklist || [];
  const checkDone = checklist.filter(i => i.status === 'Concluido').length;
  const checkPercent = checklist.length ? round2(checkDone / checklist.length * 100) : 0;

  const goals = p.goals || [];
  const goalsDone = goals.filter(g => g.status === 'Concluido').length;

  // % financeiro combinado (fundo + compras pagas vs metas)
  return {
    saldo, aportes, resgates, target, restante, percent,
    daysLeft, monthsLeft, monthlyNeeded,
    lifestyleMonthly, lifestyleAnnual, recommendedIncome,
    shopEstimated, shopPaid, shopDone, shopPending, shopPercent, shopTotal: shopping.length,
    checkDone, checkPercent, checklistTotal: checklist.length,
    goalsDone, goalsTotal: goals.length
  };
}

function projectAlerts(p, c) {
  const a = [];
  if (c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 60 && c.percent < 100)
    a.push({ level: 'medium', text: `${p.name}: faltam ${c.daysLeft} dias para a meta e voce esta com ${c.percent}% concluido.` });
  if (c.restante > 0 && c.monthsLeft === 0 && c.daysLeft !== null && c.daysLeft < 0)
    a.push({ level: 'high', text: `${p.name}: a data-alvo passou e ainda faltam ${brl(c.restante)}.` });
  if (c.monthsLeft && c.monthlyNeeded > 0)
    a.push({ level: 'low', text: `${p.name}: para chegar na meta, economize ${brl(c.monthlyNeeded)}/mes nos proximos ${c.monthsLeft} meses.` });
  // metas mensais com prazo proximo
  (p.goals || []).forEach(g => {
    if (g.status !== 'Concluido' && g.deadline) {
      const d = Math.ceil((new Date(g.deadline + 'T00:00:00') - new Date()) / 86400000);
      if (d >= 0 && d <= 15) a.push({ level: 'medium', text: `Meta "${g.text}" vence em ${d} dia(s).` });
    }
  });
  // adiantado no cronograma
  if (c.target > 0 && c.percent >= 100)
    a.push({ level: 'low', text: `${p.name}: meta financeira atingida! 🎉` });
  return a;
}

/** Resumo enxuto de um projeto (para listas e dashboard). */
function projectSummary(p) {
  const c = computeProject(p);
  return {
    id: p.id, name: p.name, status: p.status, priority: p.priority,
    targetDate: p.targetDate, target: c.target, saldo: c.saldo,
    restante: c.restante, percent: c.percent, monthlyNeeded: c.monthlyNeeded,
    daysLeft: c.daysLeft
  };
}

module.exports = { blankProject, computeProject, projectAlerts, projectSummary, round2 };
