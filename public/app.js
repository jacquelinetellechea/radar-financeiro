/* Radar Financeiro - SPA (sem build). Vanilla JS + Tailwind CDN + Chart.js */
(function () {
  'use strict';

  // ---------------- Estado ----------------
  const state = { token: localStorage.getItem('rf_token') || null, email: localStorage.getItem('rf_email') || null, page: 'dashboard', charts: {} };

  // ---------------- API ----------------
  async function api(method, path, body, isForm) {
    const opts = { method, headers: {} };
    if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
    if (body && !isForm) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    if (body && isForm) opts.body = body;
    const r = await fetch('/api' + path, opts);
    if (r.status === 401) { logout(); throw new Error('Sessao expirada'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Erro na requisicao');
    return data;
  }

  // ---------------- Utils ----------------
  const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESF = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  function mesLabel(mk) { const [y, m] = mk.split('-'); return MES[+m - 1] + '/' + y.slice(2); }
  function mesLabelFull(mk) { const [y, m] = mk.split('-'); return MESF[+m - 1] + ' de ' + y; }
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function toast(msg, type = 'info') {
    const colors = { info: 'bg-panel2 border-line', ok: 'bg-good/15 border-good/40 text-green-200', err: 'bg-bad/15 border-bad/40 text-red-200' };
    const t = document.createElement('div');
    t.className = `card px-4 py-3 border ${colors[type] || colors.info} shadow-lg fade-in text-sm max-w-xs`;
    t.textContent = msg;
    document.getElementById('toast-root').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.4s'; setTimeout(() => t.remove(), 400); }, 3200);
  }

  // ---------------- Modais ----------------
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
  function openModal(title, bodyHTML, opts = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="fixed inset-0 z-40 bg-black/60 flex items-start md:items-center justify-center p-4 overflow-auto" id="modal-bg">
        <div class="card w-full ${opts.wide ? 'max-w-3xl' : 'max-w-lg'} my-8 fade-in" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-line">
            <h3 class="font-semibold text-lg">${esc(title)}</h3>
            <button class="text-muted hover:text-white text-xl leading-none" id="modal-x">&times;</button>
          </div>
          <div class="p-5">${bodyHTML}</div>
        </div>
      </div>`;
    $('#modal-bg').addEventListener('click', closeModal);
    $('#modal-x').addEventListener('click', closeModal);
  }

  function confirmModal(text, onYes) {
    openModal('Confirmar', `
      <p class="text-slate-300 mb-5">${esc(text)}</p>
      <div class="flex justify-end gap-2">
        <button class="btn btn-ghost" id="c-no">Cancelar</button>
        <button class="btn btn-danger" id="c-yes">Excluir</button>
      </div>`);
    $('#c-no').addEventListener('click', closeModal);
    $('#c-yes').addEventListener('click', async () => { closeModal(); await onYes(); });
  }

  /* Form modal generico. fields: {name,label,type,options,value,required,step,min,col} */
  function formModal(title, fields, onSubmit, submitLabel = 'Salvar') {
    const body = `
      <form id="rf-form" class="grid grid-cols-2 gap-4">
        ${fields.map(f => `
          <div class="${f.col === 'full' ? 'col-span-2' : 'col-span-2 md:col-span-1'}">
            <label class="label">${esc(f.label)}</label>
            ${f.type === 'select'
        ? `<select class="input" name="${f.name}">${f.options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`
        : f.type === 'textarea'
          ? `<textarea class="input" name="${f.name}" rows="2">${esc(f.value || '')}</textarea>`
          : `<input class="input" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value == null ? '' : f.value)}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}/>`}
          </div>`).join('')}
        <div class="col-span-2 flex justify-end gap-2 mt-1">
          <button type="button" class="btn btn-ghost" id="f-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
        </div>
      </form>`;
    openModal(title, body, { wide: fields.length > 6 });
    $('#f-cancel').addEventListener('click', closeModal);
    $('#rf-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const obj = {};
      fields.forEach(f => { obj[f.name] = fd.get(f.name); });
      try { await onSubmit(obj); } catch (err) { toast(err.message, 'err'); }
    });
  }

  function statCard(label, value, sub, color = 'text-white') {
    return `<div class="card p-4">
      <div class="text-xs uppercase tracking-wide text-muted">${esc(label)}</div>
      <div class="text-2xl font-bold mt-1 ${color}">${value}</div>
      ${sub ? `<div class="text-xs text-muted mt-1">${sub}</div>` : ''}
    </div>`;
  }

  // ---------------- Auth ----------------
  function logout() { state.token = null; state.email = null; localStorage.removeItem('rf_token'); localStorage.removeItem('rf_email'); renderAuth(); }
  function saveSession(res) { state.token = res.token; state.email = res.email; localStorage.setItem('rf_token', res.token); localStorage.setItem('rf_email', res.email); renderShell(); go('dashboard'); }

  async function renderAuth() {
    let hasUser = true;
    try { hasUser = (await api('GET', '/auth/status')).hasUser; } catch (e) { }
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md">
          <div class="text-center mb-8">
            <div class="inline-flex items-center gap-2 text-2xl font-extrabold">
              <span class="inline-block w-9 h-9 rounded-xl bg-accent flex items-center justify-center">📡</span> Radar Financeiro
            </div>
            <p class="text-muted text-sm mt-2">Tudo o que voce vai pagar, antes de precisar pagar.</p>
          </div>
          <div class="card p-6">
            <h2 class="font-semibold text-lg mb-1">${hasUser ? 'Entrar' : 'Criar sua conta'}</h2>
            <p class="text-muted text-sm mb-5">${hasUser ? 'Acesse seu painel financeiro.' : 'Este e um ambiente privado para um unico usuario.'}</p>
            <form id="auth-form" class="space-y-4">
              <div><label class="label">E-mail</label><input class="input" name="email" type="email" required value="${hasUser ? '' : ''}"/></div>
              <div><label class="label">Senha</label><input class="input" name="password" type="password" required minlength="6"/></div>
              <button class="btn btn-primary w-full justify-center">${hasUser ? 'Entrar' : 'Criar conta'}</button>
            </form>
          </div>
          <p class="text-center text-xs text-muted mt-4">Seus dados ficam salvos com seguranca no servidor privado.</p>
        </div>
      </div>`;
    $('#auth-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api('POST', hasUser ? '/auth/login' : '/auth/register', { email: fd.get('email'), password: fd.get('password') });
        saveSession(res);
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  // ---------------- Shell / Navegacao ----------------
  const NAV = [
    ['dashboard', 'Dashboard', '📊'],
    ['cartoes', 'Cartoes', '💳'],
    ['parcelas', 'Parcelamentos', '🧾'],
    ['emprestimos', 'Emprestimos', '🤝'],
    ['receber', 'Valores a Receber', '💰'],
    ['calendario', 'Calendario', '📅'],
    ['fluxo', 'Fluxo de Caixa', '📈'],
    ['recorrentes', 'Contas Recorrentes', '🔁'],
    ['importar', 'Importar', '📥'],
    ['relatorios', 'Relatorios', '📁'],
    ['simulador', 'Simulador', '🔮'],
    ['config', 'Configuracoes', '⚙️'],
  ];

  function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="flex min-h-screen">
        <aside class="hidden md:flex flex-col w-60 bg-panel border-r border-line p-4 gap-1 sticky top-0 h-screen">
          <div class="flex items-center gap-2 px-2 mb-5">
            <span class="inline-block w-8 h-8 rounded-lg bg-accent flex items-center justify-center">📡</span>
            <div><div class="font-bold leading-tight">Radar</div><div class="text-[10px] text-muted -mt-0.5">Financeiro</div></div>
          </div>
          <nav id="nav" class="flex-1 space-y-1 overflow-auto">
            ${NAV.map(([k, l, i]) => `<div class="nav-link" data-page="${k}"><span>${i}</span>${l}</div>`).join('')}
          </nav>
          <button class="nav-link mt-2" id="logout"><span>🚪</span>Sair</button>
        </aside>
        <div class="flex-1 min-w-0">
          <header class="md:hidden flex items-center justify-between p-3 border-b border-line bg-panel sticky top-0 z-20">
            <div class="font-bold">📡 Radar</div>
            <select id="mobile-nav" class="input w-auto">${NAV.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          </header>
          <main id="content" class="p-4 md:p-8 max-w-7xl mx-auto"></main>
        </div>
      </div>`;
    $('#logout').addEventListener('click', logout);
    document.querySelectorAll('#nav .nav-link').forEach(n => n.addEventListener('click', () => go(n.dataset.page)));
    const mob = $('#mobile-nav'); if (mob) mob.addEventListener('change', () => go(mob.value));
  }

  function setActive() {
    document.querySelectorAll('#nav .nav-link').forEach(n => n.classList.toggle('active', n.dataset.page === state.page));
    const mob = $('#mobile-nav'); if (mob) mob.value = state.page;
  }

  async function go(page) {
    state.page = page;
    setActive();
    const c = $('#content');
    c.innerHTML = `<div class="text-muted py-20 text-center">Carregando…</div>`;
    try { await PAGES[page](); } catch (e) { c.innerHTML = `<div class="card p-6 text-red-300">Erro: ${esc(e.message)}</div>`; }
  }

  function pageHeader(title, subtitle, actionsHTML = '') {
    return `<div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div><h1 class="text-2xl font-bold">${esc(title)}</h1>${subtitle ? `<p class="text-muted text-sm mt-1">${esc(subtitle)}</p>` : ''}</div>
      <div class="flex gap-2">${actionsHTML}</div>
    </div>`;
  }

  // ================= PAGINAS =================
  const PAGES = {};

  // ---- Dashboard ----
  PAGES.dashboard = async function () {
    const d = await api('GET', '/dashboard');
    const c = $('#content');
    const alertColor = { high: 'border-bad/40 bg-bad/10 text-red-200', medium: 'border-warn/40 bg-warn/10 text-amber-200', low: 'border-line bg-panel2' };
    c.innerHTML = pageHeader('Dashboard', 'Visao geral do seu presente e futuro financeiro') + `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${statCard('Saldo atual', brl(d.currentBalance), mesLabelFull(d.month), d.currentBalance >= 0 ? 'text-good' : 'text-bad')}
        ${statCard('Receitas previstas', brl(d.expectedIncome), 'neste mes', 'text-good')}
        ${statCard('Despesas previstas', brl(d.expectedExpense), 'neste mes', 'text-bad')}
        ${statCard('Saldo fim do mes', brl(d.projectedBalanceEndMonth), 'projetado', d.projectedBalanceEndMonth >= 0 ? 'text-good' : 'text-bad')}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        ${statCard('Proximas faturas', brl(d.nextInvoicesTotal), 'total cartoes')}
        ${statCard('Comprometido futuro', brl(d.totalCommittedFuture), 'em parcelas')}
        ${statCard('A receber de terceiros', brl(d.loansPending), 'pendente', 'text-accent2')}
        ${statCard('Despesa liquida do mes', brl(d.cardsInvoiceNetMonth), 'fatura - reembolsos')}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div class="card p-5 lg:col-span-2">
          <h3 class="font-semibold mb-3">Evolucao do saldo projetado (12 meses)</h3>
          <canvas id="chart-balance" height="110"></canvas>
        </div>
        <div class="card p-5">
          <h3 class="font-semibold mb-3">Alertas financeiros</h3>
          <div class="space-y-2 max-h-72 overflow-auto">
            ${d.alerts.length ? d.alerts.map(a => `<div class="border rounded-lg px-3 py-2 text-sm ${alertColor[a.level]}">${esc(a.text)}</div>`).join('') : '<p class="text-muted text-sm">Nenhum alerta. Tudo sob controle. ✅</p>'}
          </div>
        </div>
      </div>
      <div class="card p-5 mb-6">
        <h3 class="font-semibold mb-3">Entradas x Saidas projetadas</h3>
        <canvas id="chart-io" height="90"></canvas>
      </div>
      <div class="card p-5">
        <h3 class="font-semibold mb-4">Limites dos cartoes</h3>
        <div class="grid md:grid-cols-2 gap-4">
          ${d.cards.length ? d.cards.map(cardBar).join('') : '<p class="text-muted text-sm">Cadastre seus cartoes na aba Cartoes.</p>'}
        </div>
      </div>`;
    const labels = d.projection.map(p => mesLabel(p.month));
    makeChart('chart-balance', 'line', labels, [{ label: 'Saldo', data: d.projection.map(p => p.balance), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.15)', fill: true, tension: .3 }]);
    makeChart('chart-io', 'bar', labels, [
      { label: 'Entradas', data: d.projection.map(p => p.income), backgroundColor: '#22c55e' },
      { label: 'Saidas', data: d.projection.map(p => p.expense), backgroundColor: '#ef4444' }
    ]);
  };

  function cardBar(c) {
    const col = c.usagePct >= 80 ? '#ef4444' : c.usagePct >= 60 ? '#f59e0b' : '#22c55e';
    return `<div class="bg-panel2 rounded-xl p-4 border border-line">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${esc(c.color)}"></span><b>${esc(c.name)}</b></div>
        <span class="chip">${esc(c.bank || '')}</span>
      </div>
      <div class="progress mb-2"><div style="width:${c.usagePct}%;background:${col}"></div></div>
      <div class="flex justify-between text-xs text-muted">
        <span>Disponivel: <b class="text-good">${brl(c.available)}</b></span>
        <span>Fatura atual: <b class="text-slate-200">${brl(c.nextInvoice)}</b></span>
      </div>
    </div>`;
  }

  function makeChart(id, type, labels, datasets) {
    const el = document.getElementById(id); if (!el) return;
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart(el, {
      type, data: { labels, datasets },
      options: {
        responsive: true, plugins: { legend: { labels: { color: '#aab3cc' } } },
        scales: { x: { ticks: { color: '#8b95b0' }, grid: { color: '#1a2233' } }, y: { ticks: { color: '#8b95b0', callback: v => 'R$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: '#1a2233' } } }
      }
    });
  }

  // ---- Cartoes ----
  PAGES.cartoes = async function () {
    const cards = await api('GET', '/cards');
    $('#content').innerHTML = pageHeader('Cartoes de Credito', 'Cadastro ilimitado com limite, fechamento e vencimento',
      `<button class="btn btn-primary" id="add">+ Novo cartao</button>`) + `
      <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${cards.length ? cards.map(cardTile).join('') : emptyState('Nenhum cartao cadastrado ainda.')}
      </div>`;
    $('#add').addEventListener('click', () => cardForm());
    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => cardForm(cards.find(c => c.id === b.dataset.edit))));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmModal('Excluir o cartao e todas as compras vinculadas?', async () => { await api('DELETE', '/cards/' + b.dataset.del); toast('Cartao excluido', 'ok'); go('cartoes'); })));
    document.querySelectorAll('[data-hist]').forEach(b => b.addEventListener('click', () => cardHistory(b.dataset.hist)));
  };
  function cardTile(c) {
    const col = c.usagePct >= 80 ? 'text-bad' : c.usagePct >= 60 ? 'text-warn' : 'text-good';
    return `<div class="card p-5" style="border-top:3px solid ${esc(c.color)}">
      <div class="flex justify-between items-start">
        <div><h3 class="font-bold text-lg">${esc(c.name)}</h3><p class="text-muted text-xs">${esc(c.bank || '')}</p></div>
        <div class="flex gap-1">
          <button class="chip" data-hist="${c.id}">Historico</button>
          <button class="chip" data-edit="${c.id}">✏️</button>
          <button class="chip" data-del="${c.id}">🗑️</button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 my-4 text-sm">
        <div><div class="text-muted text-xs">Limite total</div><b>${brl(c.limitTotal)}</b></div>
        <div><div class="text-muted text-xs">Disponivel</div><b class="text-good">${brl(c.available)}</b></div>
        <div><div class="text-muted text-xs">Comprometido</div><b class="${col}">${brl(c.committed)}</b></div>
        <div><div class="text-muted text-xs">Fatura atual</div><b>${brl(c.nextInvoice)}</b></div>
      </div>
      <div class="progress mb-2"><div style="width:${c.usagePct}%;background:${c.usagePct >= 80 ? '#ef4444' : c.usagePct >= 60 ? '#f59e0b' : '#22c55e'}"></div></div>
      <div class="flex justify-between text-xs text-muted"><span>Fecha dia ${c.closingDay}</span><span>Vence dia ${c.dueDay}</span></div>
    </div>`;
  }
  function cardForm(card) {
    formModal(card ? 'Editar cartao' : 'Novo cartao', [
      { name: 'name', label: 'Nome do cartao', required: true, value: card?.name, placeholder: 'Ex: Nubank' },
      { name: 'bank', label: 'Banco emissor', value: card?.bank, placeholder: 'Ex: Nu Pagamentos' },
      { name: 'limitTotal', label: 'Limite total (R$)', type: 'number', step: '0.01', required: true, value: card?.limitTotal },
      { name: 'color', label: 'Cor', type: 'color', value: card?.color || '#6366f1' },
      { name: 'closingDay', label: 'Dia de fechamento', type: 'number', min: 1, value: card?.closingDay || 1 },
      { name: 'dueDay', label: 'Dia de vencimento', type: 'number', min: 1, value: card?.dueDay || 10 },
    ], async v => {
      if (card) await api('PUT', '/cards/' + card.id, v); else await api('POST', '/cards', v);
      closeModal(); toast('Cartao salvo', 'ok'); go('cartoes');
    });
  }
  async function cardHistory(id) {
    const all = await api('GET', '/installments');
    const items = all.filter(i => i.cardId === id);
    openModal('Historico de compras', items.length ? `<div class="max-h-96 overflow-auto"><table><thead><tr><th>Descricao</th><th>Categoria</th><th>Total</th><th>Parcelas</th></tr></thead><tbody>
      ${items.map(i => `<tr><td>${esc(i.description)}</td><td><span class="chip">${esc(i.category)}</span></td><td>${brl(i.totalAmount)}</td><td>${i.numInstallments}x</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="text-muted">Sem compras neste cartao.</p>', { wide: true });
  }

  // ---- Parcelamentos ----
  PAGES.parcelas = async function () {
    const [insts, cards] = await Promise.all([api('GET', '/installments'), api('GET', '/cards')]);
    $('#content').innerHTML = pageHeader('Parcelamentos Inteligentes', 'Cadastre uma compra e o sistema gera todas as parcelas futuras',
      `<button class="btn btn-primary" id="add">+ Nova compra parcelada</button>`) + `
      <div class="card overflow-hidden">
        <table><thead><tr><th>Descricao</th><th>Cartao</th><th>Categoria</th><th>Total</th><th>Terceiros</th><th>Parcelas</th><th>Restante</th><th></th></tr></thead>
        <tbody>${insts.length ? insts.map(instRow).join('') : `<tr><td colspan="8" class="text-muted text-center py-8">Nenhuma compra parcelada.</td></tr>`}</tbody></table>
      </div>`;
    $('#add').addEventListener('click', () => instForm(cards));
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => instDetail(insts.find(i => i.id === b.dataset.view))));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmModal('Excluir esta compra e suas parcelas?', async () => { await api('DELETE', '/installments/' + b.dataset.del); toast('Excluido', 'ok'); go('parcelas'); })));
  };
  function instRow(i) {
    const paid = i.items.filter(x => x.paid).length;
    const restante = i.items.filter(x => !x.paid).reduce((s, x) => s + x.amount, 0);
    const terceiros = i.items.reduce((s, x) => s + (x.reimburseAmount || 0), 0);
    return `<tr>
      <td><b>${esc(i.description)}</b>${i.reimbursePerson ? `<div class="text-xs text-accent2">↩ ${esc(i.reimbursePerson)}</div>` : ''}</td>
      <td>${esc(i.cardName)}</td>
      <td><span class="chip">${esc(i.category)}</span></td>
      <td>${brl(i.totalAmount)}</td>
      <td>${terceiros > 0 ? `<span class="text-accent2">${brl(terceiros)}</span><div class="text-[10px] text-muted">minha: ${brl(i.totalAmount - terceiros)}</div>` : '<span class="text-muted">—</span>'}</td>
      <td>${paid}/${i.numInstallments}</td><td class="text-bad">${brl(restante)}</td>
      <td class="text-right whitespace-nowrap"><button class="chip" data-view="${i.id}">Editar</button> <button class="chip" data-del="${i.id}">🗑️</button></td>
    </tr>`;
  }
  function instForm(cards) {
    if (!cards.length) { toast('Cadastre um cartao primeiro', 'err'); return; }
    formModal('Nova compra parcelada', [
      { name: 'description', label: 'Descricao', required: true, col: 'full', placeholder: 'Ex: Notebook' },
      { name: 'cardId', label: 'Cartao', type: 'select', options: cards.map(c => ({ value: c.id, label: c.name })) },
      { name: 'category', label: 'Categoria', type: 'select', options: ['Compras', 'Alimentacao', 'Transporte', 'Saude', 'Lazer', 'Casa', 'Educacao', 'Emprestimo', 'Outros'].map(c => ({ value: c, label: c })) },
      { name: 'totalAmount', label: 'Valor total (R$)', type: 'number', step: '0.01', required: true },
      { name: 'numInstallments', label: 'Numero de parcelas', type: 'number', min: 1, value: 1, required: true },
      { name: 'purchaseDate', label: 'Data da compra', type: 'date', value: new Date().toISOString().slice(0, 10) },
      { name: 'reimbursePerson', label: 'Terceiro reembolsa? (opcional)', placeholder: 'Ex: Minha mae' },
      { name: 'reimburseTotal', label: 'Valor total que o terceiro deve (opcional)', type: 'number', step: '0.01' },
    ], async v => { await api('POST', '/installments', v); closeModal(); toast('Parcelas geradas automaticamente', 'ok'); go('parcelas'); });
  }
  function instDetail(i) {
    const rows = i.items.map(it => `<tr>
      <td>${it.number}</td>
      <td><input class="input" style="width:135px" type="date" data-f="dueISO" data-n="${it.number}" value="${it.dueISO}"/></td>
      <td><input class="input" style="width:95px" type="number" step="0.01" data-f="amount" data-n="${it.number}" value="${it.amount}"/></td>
      <td><input class="input" style="width:95px" type="number" step="0.01" min="0" data-f="reimburseAmount" data-n="${it.number}" value="${it.reimburseAmount || 0}"/></td>
      <td class="text-center"><input type="checkbox" data-f="paid" data-n="${it.number}" ${it.paid ? 'checked' : ''}/></td>
      <td class="text-center"><input type="checkbox" data-f="reimburseReceived" data-n="${it.number}" ${it.reimburseReceived ? 'checked' : ''}/></td>
    </tr>`).join('');
    openModal(`Editar parcelas: ${i.description}`, `
      <div class="mb-3">
        <label class="label">Quem reembolsa parte desta compra? (opcional)</label>
        <input class="input" id="inst-person" placeholder="Ex: Minha mae" value="${esc(i.reimbursePerson || '')}"/>
        <p class="text-xs text-muted mt-1">Em "Parte de terceiro", coloque quanto a outra pessoa te devolve em cada parcela. O restante e a sua despesa. Voce tambem pode editar o valor e o vencimento de cada parcela.</p>
      </div>
      <div class="max-h-80 overflow-auto"><table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Parte de terceiro</th><th>Paga</th><th>Recebido</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="flex justify-end gap-2 mt-4"><button class="btn btn-ghost" id="inst-cancel">Fechar</button><button class="btn btn-primary" id="inst-save">Salvar alteracoes</button></div>
    `, { wide: true });
    $('#inst-cancel').addEventListener('click', closeModal);
    $('#inst-save').addEventListener('click', async () => {
      const map = {};
      document.querySelectorAll('[data-n]').forEach(el => {
        const n = el.dataset.n; map[n] = map[n] || { number: Number(n) };
        map[n][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      });
      try {
        await api('PUT', `/installments/${i.id}/items`, { reimbursePerson: $('#inst-person').value, items: Object.values(map) });
        closeModal(); toast('Parcelas atualizadas', 'ok'); go('parcelas');
      } catch (e) { toast(e.message, 'err'); }
    });
  }

  // ---- Emprestimos ----
  PAGES.emprestimos = async function () {
    const [loans, cards] = await Promise.all([api('GET', '/loans'), api('GET', '/cards')]);
    $('#content').innerHTML = pageHeader('Emprestimos para Terceiros', 'Controle o que voce emprestou e o que tem a receber',
      `<button class="btn btn-primary" id="add">+ Novo emprestimo</button>`) + `
      <div class="grid md:grid-cols-2 gap-4">
        ${loans.length ? loans.map(loanTile).join('') : emptyState('Nenhum emprestimo registrado.')}
      </div>`;
    $('#add').addEventListener('click', () => loanForm(cards));
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => loanDetail(loans.find(l => l.id === b.dataset.view))));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmModal('Excluir este emprestimo?', async () => { await api('DELETE', '/loans/' + b.dataset.del); toast('Excluido', 'ok'); go('emprestimos'); })));
  };
  function loanTile(l) {
    const pct = l.total > 0 ? Math.round((l.received / l.total) * 100) : 0;
    return `<div class="card p-5">
      <div class="flex justify-between items-start mb-2">
        <div><h3 class="font-bold">${esc(l.person)}</h3><p class="text-muted text-xs">${esc(l.description)} · ${esc(l.method)}</p></div>
        <div class="flex gap-1"><button class="chip" data-view="${l.id}">Ver</button><button class="chip" data-del="${l.id}">🗑️</button></div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-sm my-3">
        <div><div class="text-muted text-xs">Total</div><b>${brl(l.total)}</b></div>
        <div><div class="text-muted text-xs">Recebido</div><b class="text-good">${brl(l.received)}</b></div>
        <div><div class="text-muted text-xs">Pendente</div><b class="text-warn">${brl(l.pending)}</b></div>
      </div>
      <div class="progress mb-2"><div style="width:${pct}%;background:#22c55e"></div></div>
      <div class="flex justify-between text-xs text-muted">
        <span>${pct}% recebido</span>
        ${l.overdue > 0 ? `<span class="text-bad">Atrasado: ${brl(l.overdue)}</span>` : l.nextDue ? `<span>Proximo: ${l.nextDue.split('-').reverse().join('/')}</span>` : '<span class="text-good">Quitado</span>'}
      </div>
    </div>`;
  }
  function loanForm(cards) {
    formModal('Novo emprestimo a terceiro', [
      { name: 'person', label: 'Nome da pessoa', required: true },
      { name: 'description', label: 'Descricao', placeholder: 'Ex: Celular Samsung' },
      { name: 'totalAmount', label: 'Valor total (R$)', type: 'number', step: '0.01', required: true },
      { name: 'numInstallments', label: 'Numero de parcelas', type: 'number', min: 1, value: 1, required: true },
      { name: 'firstDueISO', label: '1o vencimento (reembolso)', type: 'date', value: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10) },
      { name: 'method', label: 'Forma de pagamento', type: 'select', options: ['Dinheiro', 'Pix', 'Cartao', 'A definir'].map(m => ({ value: m, label: m })) },
      { name: 'cardId', label: 'Comprado no cartao? (opcional)', type: 'select', options: [{ value: '', label: 'Nao / a vista' }].concat(cards.map(c => ({ value: c.id, label: c.name }))) },
      { name: 'createCardExpense', label: 'Gerar tambem a fatura que EU pago?', type: 'select', options: [{ value: '', label: 'Nao' }, { value: '1', label: 'Sim, lancar no cartao' }] },
    ], async v => { v.createCardExpense = !!v.createCardExpense; await api('POST', '/loans', v); closeModal(); toast('Emprestimo registrado', 'ok'); go('emprestimos'); });
  }
  function loanDetail(l) {
    openModal(`Reembolsos: ${l.person}`, `<div class="max-h-96 overflow-auto"><table><thead><tr><th>#</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>
      ${l.items.map(it => `<tr><td>${it.number}</td><td>${it.dueISO.split('-').reverse().join('/')}</td><td>${brl(it.amount)}</td>
        <td><button class="badge ${it.settled ? 'bg-good/20 text-green-300' : 'bg-panel2 text-muted'}" data-rec="${it.number}">${it.settled ? '✓ Recebido' : 'Marcar recebido'}</button></td></tr>`).join('')}
    </tbody></table></div>`, { wide: true });
    document.querySelectorAll('[data-rec]').forEach(b => b.addEventListener('click', async () => { await api('POST', `/loans/${l.id}/receive/${b.dataset.rec}`); closeModal(); toast('Atualizado', 'ok'); go('emprestimos'); }));
  }

  // ---- Valores a Receber ----
  PAGES.receber = async function () {
    const items = await api('GET', '/receivables');
    const totalPend = items.reduce((s, l) => s + l.pending, 0);
    const totalRec = items.reduce((s, l) => s + l.received, 0);
    const totalOver = items.reduce((s, l) => s + l.overdue, 0);
    $('#content').innerHTML = pageHeader('Valores a Receber', 'Emprestimos e reembolsos de compras (parte de terceiros)') + `
      <div class="grid grid-cols-3 gap-4 mb-6">
        ${statCard('Total pendente', brl(totalPend), null, 'text-warn')}
        ${statCard('Ja recebido', brl(totalRec), null, 'text-good')}
        ${statCard('Em atraso', brl(totalOver), null, 'text-bad')}
      </div>
      <div class="card overflow-hidden">
        <table><thead><tr><th>Pessoa</th><th>Descricao</th><th>Origem</th><th>Total</th><th>Recebido</th><th>Pendente</th><th>Proximo venc.</th><th>Status</th></tr></thead>
        <tbody>${items.length ? items.map(l => `<tr>
          <td><b>${esc(l.person)}</b></td><td>${esc(l.description)}</td>
          <td><span class="chip">${l.source === 'installment' ? 'Cartao/parcela' : 'Emprestimo'}</span></td>
          <td>${brl(l.total)}</td><td class="text-good">${brl(l.received)}</td><td class="text-warn">${brl(l.pending)}</td>
          <td>${l.nextDue ? l.nextDue.split('-').reverse().join('/') : '—'}</td>
          <td>${l.overdue > 0 ? '<span class="badge bg-bad/20 text-red-300">Atrasado</span>' : l.pending === 0 ? '<span class="badge bg-good/20 text-green-300">Quitado</span>' : '<span class="badge bg-panel2 text-muted">Em dia</span>'}</td>
        </tr>`).join('') : `<tr><td colspan="8" class="text-center text-muted py-8">Nenhum valor a receber.</td></tr>`}</tbody></table>
      </div>`;
  };

  // ---- Calendario ----
  PAGES.calendario = async function (mk) {
    mk = mk || new Date().toISOString().slice(0, 7);
    const data = await api('GET', '/calendar?month=' + mk);
    const [y, m] = mk.split('-').map(Number);
    const firstDow = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const byDay = {};
    data.events.forEach(e => { (byDay[e.day] = byDay[e.day] || []).push(e); });
    const prev = new Date(y, m - 2, 1).toISOString().slice(0, 7);
    const next = new Date(y, m, 1).toISOString().slice(0, 7);
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += `<div></div>`;
    for (let day = 1; day <= days; day++) {
      const evs = byDay[day] || [];
      cells += `<div class="bg-panel2 border border-line rounded-lg p-1.5 min-h-[86px] text-xs">
        <div class="text-muted mb-1">${day}</div>
        ${evs.slice(0, 4).map(e => `<div class="truncate ${e.type === 'income' ? 'text-good' : 'text-red-300'}" title="${esc(e.label)} - ${brl(e.amount)}">${e.type === 'income' ? '▲' : '▼'} ${brl(e.amount)}</div>`).join('')}
        ${evs.length > 4 ? `<div class="text-muted">+${evs.length - 4}</div>` : ''}
      </div>`;
    }
    const totIn = data.events.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const totOut = data.events.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    $('#content').innerHTML = pageHeader('Calendario Financeiro', 'Receitas, despesas, faturas e recebimentos do mes',
      `<button class="btn btn-ghost" id="prev">‹ Anterior</button><span class="btn btn-ghost pointer-events-none">${mesLabelFull(mk)}</span><button class="btn btn-ghost" id="next">Proximo ›</button>`) + `
      <div class="grid grid-cols-3 gap-4 mb-5">
        ${statCard('Entradas do mes', brl(totIn), null, 'text-good')}
        ${statCard('Saidas do mes', brl(totOut), null, 'text-bad')}
        ${statCard('Saldo do mes', brl(totIn - totOut), null, (totIn - totOut) >= 0 ? 'text-good' : 'text-bad')}
      </div>
      <div class="card p-4">
        <div class="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-muted">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => `<div>${d}</div>`).join('')}</div>
        <div class="grid grid-cols-7 gap-1">${cells}</div>
      </div>
      <div class="card p-5 mt-5">
        <h3 class="font-semibold mb-3">Eventos de ${mesLabelFull(mk)}</h3>
        <div class="space-y-1 max-h-72 overflow-auto">
          ${data.events.length ? data.events.map(e => `<div class="flex justify-between text-sm border-b border-line/50 py-1.5">
            <span>Dia ${e.day} · <span class="chip">${esc(e.kind)}</span> ${esc(e.label)}</span>
            <b class="${e.type === 'income' ? 'text-good' : 'text-red-300'}">${e.type === 'income' ? '+' : '-'}${brl(e.amount)}</b></div>`).join('') : '<p class="text-muted text-sm">Sem eventos.</p>'}
        </div>
      </div>`;
    $('#prev').addEventListener('click', () => PAGES.calendario(prev));
    $('#next').addEventListener('click', () => PAGES.calendario(next));
  };

  // ---- Fluxo de Caixa ----
  PAGES.fluxo = async function (count) {
    count = count || 12;
    const proj = await api('GET', '/projection?count=' + count);
    $('#content').innerHTML = pageHeader('Fluxo de Caixa Projetado', 'Projecao de entradas, saidas e saldo',
      [12, 24, 36].map(n => `<button class="btn ${n == count ? 'btn-primary' : 'btn-ghost'}" data-n="${n}">${n} meses</button>`).join('')) + `
      <div class="card p-5 mb-5"><canvas id="chart-flux" height="90"></canvas></div>
      <div class="card overflow-hidden">
        <table><thead><tr><th>Mes</th><th>Entradas</th><th>Saidas</th><th>Faturas</th><th>Saldo mes</th><th>Saldo acumulado</th></tr></thead>
        <tbody>${proj.map(p => `<tr class="${p.risk ? 'bg-bad/5' : ''}">
          <td><b>${mesLabel(p.month)}</b></td><td class="text-good">${brl(p.income)}</td>
          <td class="text-bad">${brl(p.expense)}</td><td>${brl(p.cardsInvoice)}</td>
          <td class="${p.net >= 0 ? 'text-good' : 'text-bad'}">${brl(p.net)}</td>
          <td class="${p.balance >= 0 ? 'text-good' : 'text-bad'}"><b>${brl(p.balance)}</b> ${p.risk ? '<span class="badge bg-bad/20 text-red-300 ml-1">risco</span>' : ''}</td>
        </tr>`).join('')}</tbody></table>
      </div>`;
    const labels = proj.map(p => mesLabel(p.month));
    makeChart('chart-flux', 'line', labels, [
      { label: 'Saldo acumulado', data: proj.map(p => p.balance), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.15)', fill: true, tension: .3 },
      { label: 'Entradas', data: proj.map(p => p.income), borderColor: '#22c55e', tension: .3 },
      { label: 'Saidas', data: proj.map(p => p.expense), borderColor: '#ef4444', tension: .3 },
    ]);
    document.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => PAGES.fluxo(+b.dataset.n)));
  };

  // ---- Recorrentes ----
  PAGES.recorrentes = async function () {
    const recs = await api('GET', '/recurrings');
    $('#content').innerHTML = pageHeader('Contas Recorrentes', 'Cadastre uma vez e o sistema replica todo mes',
      `<button class="btn btn-primary" id="add">+ Nova recorrencia</button>`) + `
      <div class="card overflow-hidden">
        <table><thead><tr><th>Descricao</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Dia</th><th>Inicio</th><th></th></tr></thead>
        <tbody>${recs.length ? recs.map(r => `<tr>
          <td><b>${esc(r.description)}</b></td>
          <td>${r.type === 'income' ? '<span class="badge bg-good/20 text-green-300">Receita</span>' : '<span class="badge bg-bad/20 text-red-300">Despesa</span>'}</td>
          <td><span class="chip">${esc(r.category)}</span></td><td>${brl(r.amount)}</td><td>${r.dayOfMonth}</td><td>${mesLabel(r.startMonth)}</td>
          <td class="text-right whitespace-nowrap"><button class="chip" data-edit="${r.id}">✏️</button> <button class="chip" data-del="${r.id}">🗑️</button></td>
        </tr>`).join('') : `<tr><td colspan="7" class="text-center text-muted py-8">Nenhuma conta recorrente.</td></tr>`}</tbody></table>
      </div>`;
    $('#add').addEventListener('click', () => recForm());
    document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => recForm(recs.find(r => r.id === b.dataset.edit))));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmModal('Excluir esta recorrencia?', async () => { await api('DELETE', '/recurrings/' + b.dataset.del); toast('Excluido', 'ok'); go('recorrentes'); })));
  };
  function recForm(r) {
    formModal(r ? 'Editar recorrencia' : 'Nova conta recorrente', [
      { name: 'description', label: 'Descricao', required: true, col: 'full', value: r?.description, placeholder: 'Ex: Aluguel' },
      { name: 'type', label: 'Tipo', type: 'select', value: r?.type || 'expense', options: [{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }] },
      { name: 'category', label: 'Categoria', value: r?.category, placeholder: 'Ex: Moradia' },
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', required: true, value: r?.amount },
      { name: 'dayOfMonth', label: 'Dia do mes', type: 'number', min: 1, value: r?.dayOfMonth || 1 },
      { name: 'startMonth', label: 'Inicio (AAAA-MM)', value: r?.startMonth || new Date().toISOString().slice(0, 7) },
      { name: 'endMonth', label: 'Fim (opcional, AAAA-MM)', value: r?.endMonth || '' },
    ], async v => { if (!v.endMonth) v.endMonth = null; if (r) await api('PUT', '/recurrings/' + r.id, v); else await api('POST', '/recurrings', v); closeModal(); toast('Salvo', 'ok'); go('recorrentes'); });
  }

  // ---- Importar ----
  PAGES.importar = async function () {
    const cards = await api('GET', '/cards');
    $('#content').innerHTML = pageHeader('Importacao Automatica', 'Envie CSV, Excel ou PDF de fatura. O sistema detecta os lancamentos.') + `
      <div class="card p-6 max-w-2xl">
        <label class="label">Cartao de destino (compras viram parcelas nele)</label>
        <select class="input mb-4" id="imp-card">
          <option value="">Sem cartao (lancar como despesas/receitas avulsas)</option>
          ${cards.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <label class="label">Arquivo (.csv, .xlsx, .pdf)</label>
        <input class="input mb-4" type="file" id="imp-file" accept=".csv,.xlsx,.xls,.pdf" />
        <button class="btn btn-primary" id="imp-go">Analisar arquivo</button>
        <p class="text-xs text-muted mt-3">CSV/Excel sao lidos automaticamente. Para PDF, o texto e extraido e voce confirma os lancamentos detectados antes de salvar.</p>
      </div>
      <div id="imp-result" class="mt-6"></div>`;
    $('#imp-go').addEventListener('click', async () => {
      const f = $('#imp-file').files[0];
      if (!f) return toast('Selecione um arquivo', 'err');
      const fd = new FormData(); fd.append('file', f);
      $('#imp-result').innerHTML = '<p class="text-muted">Analisando…</p>';
      try {
        const res = await api('POST', '/import/parse', fd, true);
        renderImportPreview(res, $('#imp-card').value);
      } catch (e) { $('#imp-result').innerHTML = `<div class="card p-4 text-red-300">${esc(e.message)}</div>`; }
    });
  };
  function renderImportPreview(res, cardId) {
    if (!res.items.length) { $('#imp-result').innerHTML = '<div class="card p-4 text-muted">Nenhum lancamento detectado no arquivo.</div>'; return; }
    window._imp = res.items.map(i => ({ ...i, skip: !!i.duplicate, type: i.isIncome ? 'income' : 'expense' }));
    const dups = window._imp.filter(i => i.duplicate).length;
    $('#imp-result').innerHTML = `
      <div class="card p-5">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-semibold">${res.count} lancamentos detectados em ${esc(res.filename)}${dups ? ` · <span class="text-warn">${dups} ja cadastrado(s), desmarcados</span>` : ''}</h3>
          <button class="btn btn-primary" id="imp-commit">Confirmar e salvar</button>
        </div>
        <div class="max-h-96 overflow-auto"><table><thead><tr><th>Incluir</th><th>Data</th><th>Descricao</th><th>Categoria</th><th>Parcelas</th><th>Valor</th></tr></thead>
        <tbody>${window._imp.map((it, idx) => `<tr class="${it.duplicate ? 'opacity-60' : ''}">
          <td><input type="checkbox" data-skip="${idx}" ${it.skip ? '' : 'checked'}/></td>
          <td>${it.date.split('-').reverse().join('/')}</td>
          <td>${esc(it.description)} ${it.duplicate ? '<span class="badge bg-warn/20 text-amber-300">ja cadastrado</span>' : ''}</td><td><span class="chip">${esc(it.category)}</span></td>
          <td>${it.installment ? it.installment.current + '/' + it.installment.total : '1x'}</td>
          <td class="${it.type === 'income' ? 'text-good' : ''}">${brl(it.amount)}</td>
        </tr>`).join('')}</tbody></table></div>
      </div>`;
    document.querySelectorAll('[data-skip]').forEach(cb => cb.addEventListener('change', () => { window._imp[cb.dataset.skip].skip = !cb.checked; }));
    $('#imp-commit').addEventListener('click', async () => {
      try { const r = await api('POST', '/import/commit', { cardId, items: window._imp }); toast(`${r.created} lancamentos importados`, 'ok'); go('dashboard'); }
      catch (e) { toast(e.message, 'err'); }
    });
  }

  // ---- Relatorios ----
  PAGES.relatorios = async function (months) {
    months = months || 6;
    const rep = await api('GET', '/reports?months=' + months);
    const cats = Object.entries(rep.byCategory).sort((a, b) => b[1] - a[1]);
    $('#content').innerHTML = pageHeader('Relatorios e Analises', `Ultimos ${months} meses`,
      [3, 6, 12].map(n => `<button class="btn ${n == months ? 'btn-primary' : 'btn-ghost'}" data-m="${n}">${n}m</button>`).join('')) + `
      <div class="grid grid-cols-3 gap-4 mb-6">
        ${statCard('Emprestado (total)', brl(rep.loansLent), null, 'text-accent2')}
        ${statCard('Recebido', brl(rep.loansReceived), null, 'text-good')}
        ${statCard('A receber', brl(rep.loansPending), null, 'text-warn')}
      </div>
      <div class="grid lg:grid-cols-2 gap-6 mb-6">
        <div class="card p-5"><h3 class="font-semibold mb-3">Gastos por categoria</h3><canvas id="chart-cat" height="200"></canvas></div>
        <div class="card p-5"><h3 class="font-semibold mb-3">Cartoes mais utilizados</h3><canvas id="chart-cards" height="200"></canvas></div>
      </div>
      <div class="card p-5"><h3 class="font-semibold mb-3">Fluxo de caixa (${months} meses)</h3><canvas id="chart-rep-flux" height="90"></canvas></div>`;
    const palette = ['#6366f1', '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
    new Chart($('#chart-cat'), { type: 'doughnut', data: { labels: cats.map(c => c[0]), datasets: [{ data: cats.map(c => c[1]), backgroundColor: palette }] }, options: { plugins: { legend: { position: 'right', labels: { color: '#aab3cc' } } } } });
    makeChart('chart-cards', 'bar', rep.cardUsage.map(c => c.name), [{ label: 'Total', data: rep.cardUsage.map(c => c.total), backgroundColor: '#6366f1' }]);
    makeChart('chart-rep-flux', 'bar', rep.cashflow.map(p => mesLabel(p.month)), [
      { label: 'Entradas', data: rep.cashflow.map(p => p.income), backgroundColor: '#22c55e' },
      { label: 'Saidas', data: rep.cashflow.map(p => p.expense), backgroundColor: '#ef4444' }
    ]);
    document.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => PAGES.relatorios(+b.dataset.m)));
  };

  // ---- Simulador ----
  PAGES.simulador = async function () {
    const cards = await api('GET', '/cards');
    $('#content').innerHTML = pageHeader('Simulador de Impacto', 'Veja como uma nova compra parcelada afeta seus proximos meses') + `
      <div class="card p-6 max-w-2xl mb-6">
        <div class="grid grid-cols-2 gap-4">
          <div><label class="label">Cartao</label><select class="input" id="s-card">${cards.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
          <div><label class="label">Data da compra</label><input class="input" type="date" id="s-date" value="${new Date().toISOString().slice(0, 10)}"/></div>
          <div><label class="label">Valor (R$)</label><input class="input" type="number" step="0.01" id="s-amount" placeholder="2000"/></div>
          <div><label class="label">Parcelas</label><input class="input" type="number" min="1" id="s-n" value="10"/></div>
        </div>
        <button class="btn btn-primary mt-4" id="s-go">Simular impacto</button>
      </div>
      <div id="s-result"></div>`;
    $('#s-go').addEventListener('click', async () => {
      if (!cards.length) return toast('Cadastre um cartao primeiro', 'err');
      try {
        const r = await api('POST', '/simulate', { cardId: $('#s-card').value, totalAmount: $('#s-amount').value, numInstallments: $('#s-n').value, purchaseDate: $('#s-date').value });
        renderSim(r);
      } catch (e) { toast(e.message, 'err'); }
    });
  };
  function renderSim(r) {
    $('#s-result').innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        ${statCard('Valor por parcela', brl(r.perInstallment))}
        ${statCard('Limite disponivel apos', brl(r.cardAfter.available), `antes: ${brl(r.cardBefore.available)}`, r.cardAfter.available >= 0 ? 'text-good' : 'text-bad')}
        ${statCard('Pior saldo (12m)', brl(r.worstMonth.balance), mesLabelFull(r.worstMonth.month), r.worstMonth.balance >= 0 ? 'text-good' : 'text-bad')}
        ${statCard('Uso do cartao apos', r.cardAfter.usagePct + '%', `antes: ${r.cardBefore.usagePct}%`, r.cardAfter.usagePct >= 80 ? 'text-bad' : 'text-good')}
      </div>
      ${r.worstMonth.balance < 0 ? '<div class="card p-4 mb-5 border-bad/40 bg-bad/10 text-red-200">⚠️ Atencao: esta compra deixa seu saldo projetado negativo em algum mes.</div>' : '<div class="card p-4 mb-5 border-good/40 bg-good/10 text-green-200">✅ Esta compra cabe no seu fluxo projetado.</div>'}
      <div class="card p-5"><h3 class="font-semibold mb-3">Saldo projetado: antes x depois</h3><canvas id="chart-sim" height="90"></canvas></div>`;
    makeChart('chart-sim', 'line', r.before.map(p => mesLabel(p.month)), [
      { label: 'Antes', data: r.before.map(p => p.balance), borderColor: '#8b95b0', tension: .3 },
      { label: 'Depois da compra', data: r.after.map(p => p.balance), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.15)', fill: true, tension: .3 }
    ]);
  }

  // ---- Configuracoes ----
  PAGES.config = async function () {
    const s = await api('GET', '/settings');
    $('#content').innerHTML = pageHeader('Configuracoes', 'Saldo inicial, seguranca e backup') + `
      <div class="grid lg:grid-cols-2 gap-6">
        <div class="card p-6">
          <h3 class="font-semibold mb-4">Saldo atual</h3>
          <label class="label">Saldo em conta hoje (R$)</label>
          <div class="flex gap-2"><input class="input" type="number" step="0.01" id="cfg-balance" value="${s.currentBalance || 0}"/><button class="btn btn-primary" id="cfg-save">Salvar</button></div>
          <p class="text-xs text-muted mt-2">Este valor e a base das projecoes de fluxo de caixa.</p>
        </div>
        <div class="card p-6">
          <h3 class="font-semibold mb-4">Seguranca</h3>
          <button class="btn btn-ghost mb-2 w-full justify-center" id="cfg-pass">Alterar senha</button>
          <p class="text-xs text-muted">Login protegido por senha (hash bcrypt) e sessao com token assinado.</p>
        </div>
        <div class="card p-6">
          <h3 class="font-semibold mb-4">Backup e exportacao</h3>
          <div class="flex flex-col gap-2">
            <button class="btn btn-primary justify-center" id="cfg-export">⬇️ Exportar todos os dados (JSON)</button>
            <label class="btn btn-ghost justify-center cursor-pointer">⬆️ Importar backup<input type="file" id="cfg-import" accept=".json" class="hidden"/></label>
          </div>
          <p class="text-xs text-muted mt-2">Backups automaticos sao mantidos no servidor (30 versoes). Use a exportacao para guardar uma copia externa.</p>
        </div>
        <div class="card p-6">
          <h3 class="font-semibold mb-4">Conta</h3>
          <p class="text-sm text-muted mb-1">Usuario: <b class="text-slate-200">${esc(state.email)}</b></p>
          <button class="btn btn-danger mt-3" id="cfg-logout">Sair</button>
        </div>
      </div>`;
    $('#cfg-save').addEventListener('click', async () => { await api('PUT', '/settings', { currentBalance: $('#cfg-balance').value }); toast('Salvo', 'ok'); });
    $('#cfg-logout').addEventListener('click', logout);
    $('#cfg-pass').addEventListener('click', () => formModal('Alterar senha', [
      { name: 'current', label: 'Senha atual', type: 'password', col: 'full', required: true },
      { name: 'next', label: 'Nova senha', type: 'password', col: 'full', required: true },
    ], async v => { await api('POST', '/auth/change-password', v); closeModal(); toast('Senha alterada', 'ok'); }));
    $('#cfg-export').addEventListener('click', async () => {
      const d = await api('GET', '/backup/export');
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'radar-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    });
    $('#cfg-import').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      confirmModal('Importar backup SUBSTITUI todos os dados atuais. Continuar?', async () => {
        const text = await f.text();
        await api('POST', '/backup/import', JSON.parse(text));
        toast('Backup importado', 'ok'); go('dashboard');
      });
    });
  };

  function emptyState(msg) { return `<div class="card p-10 text-center text-muted col-span-full">${esc(msg)}</div>`; }

  // ---------------- Boot ----------------
  if (state.token) { renderShell(); go('dashboard'); } else { renderAuth(); }
})();
