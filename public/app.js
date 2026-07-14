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
    const colors = { info: 'bg-panel2 border-line', ok: 'bg-good/15 border-good/40 text-good', err: 'bg-bad/15 border-bad/40 text-bad' };
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
      <div class="fixed inset-0 z-40 bg-ink/30 flex items-start md:items-center justify-center p-4 overflow-auto" id="modal-bg">
        <div class="card w-full ${opts.wide ? 'max-w-3xl' : 'max-w-lg'} my-8 fade-in" onclick="event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-line">
            <h3 class="font-semibold text-lg">${esc(title)}</h3>
            <button class="text-muted hover:text-ink text-xl leading-none" id="modal-x">&times;</button>
          </div>
          <div class="p-5">${bodyHTML}</div>
        </div>
      </div>`;
    $('#modal-bg').addEventListener('click', closeModal);
    $('#modal-x').addEventListener('click', closeModal);
  }

  function confirmModal(text, onYes) {
    openModal('Confirmar', `
      <p class="text-muted mb-5">${esc(text)}</p>
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

  function statCard(label, value, sub, color = 'text-ink') {
    return `<div class="card p-4">
      <div class="text-xs uppercase tracking-wide text-muted">${esc(label)}</div>
      <div class="text-2xl money mt-1 ${color}">${value}</div>
      ${sub ? `<div class="text-xs text-muted mt-1">${sub}</div>` : ''}
    </div>`;
  }

  // ---------------- Auth ----------------
  function logout() { state.token = null; state.email = null; localStorage.removeItem('rf_token'); localStorage.removeItem('rf_email'); renderAuth(); }
  function saveSession(res) { state.token = res.token; state.email = res.email; localStorage.setItem('rf_token', res.token); localStorage.setItem('rf_email', res.email); state.app = 'hub'; renderHub(); }

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
  const NAV_RADAR = [
    ['dashboard', 'Dashboard', '📊'],
    ['vida', 'Projeto de Vida', '🎯'],
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
  const NAV_EVENTOS = [
    ['eventos', 'Eventos', '🎉'],
  ];

  function renderShell() {
    const isEv = state.app === 'eventos';
    const NAV = isEv ? NAV_EVENTOS : NAV_RADAR;
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="flex min-h-screen">
        <aside class="hidden md:flex flex-col w-64 bg-sand border-r border-line p-4 gap-1 sticky top-0 h-screen">
          <div class="flex items-center gap-3 px-2 mb-6 mt-2">
            <span class="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-lg font-display" style="background:#B9502C">${isEv ? 'e' : 'r'}</span>
            <div><div class="font-display text-lg leading-tight">${isEv ? 'Eventos' : 'Radar'}</div><div class="text-[10px] tracking-widest text-muted uppercase">${isEv ? 'Organizacao' : 'Financeiro'}</div></div>
          </div>
          <div class="nav-link" id="to-hub"><span>←</span>Projetos</div>
          <div class="nav-label">Este projeto</div>
          <nav id="nav" class="flex-1 space-y-1 overflow-auto">
            ${NAV.map(([k, l, i]) => `<div class="nav-link" data-page="${k}"><span>${i}</span>${l}</div>`).join('')}
          </nav>
          <button class="nav-link mt-2" id="logout"><span>🚪</span>Sair</button>
        </aside>
        <div class="flex-1 min-w-0">
          <header class="md:hidden flex items-center justify-between p-3 border-b border-line bg-panel sticky top-0 z-20">
            <button class="font-bold" id="to-hub-m">← ${isEv ? '🎉 Eventos' : '📡 Radar'}</button>
            <select id="mobile-nav" class="input w-auto">${NAV.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          </header>
          <main id="content" class="p-4 md:p-8 max-w-7xl mx-auto"></main>
        </div>
      </div>`;
    $('#logout').addEventListener('click', logout);
    if ($('#to-hub')) $('#to-hub').addEventListener('click', () => { state.app = 'hub'; renderHub(); });
    if ($('#to-hub-m')) $('#to-hub-m').addEventListener('click', () => { state.app = 'hub'; renderHub(); });
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
    try { await PAGES[page](); } catch (e) { c.innerHTML = `<div class="card p-6 text-bad">Erro: ${esc(e.message)}</div>`; }
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
    const alertColor = { high: 'border-bad/40 bg-bad/10 text-bad', medium: 'border-warn/40 bg-warn/10 text-warn', low: 'border-line bg-panel2' };
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
      ${d.projects && d.projects.length ? `<div class="card p-5 mb-6"><h3 class="font-semibold mb-4">Projetos de Vida</h3><div class="grid md:grid-cols-2 gap-4">${d.projects.map(pr => `<div class="bg-panel2 rounded-xl p-4 border border-line cursor-pointer" data-goproj="${pr.id}"><div class="flex justify-between items-center"><b>${esc(pr.name)}</b><span class="chip">${pr.percent}%</span></div><div class="progress my-2"><div style="width:${pr.percent}%;background:#C4622F"></div></div><div class="text-xs text-muted flex justify-between"><span>${brl(pr.saldo)} / ${brl(pr.target)}</span><span>${pr.daysLeft != null ? pr.daysLeft + ' dias' : ''}</span></div></div>`).join('')}</div></div>` : ''}
      <div class="card p-5">
        <h3 class="font-semibold mb-4">Limites dos cartoes</h3>
        <div class="grid md:grid-cols-2 gap-4">
          ${d.cards.length ? d.cards.map(cardBar).join('') : '<p class="text-muted text-sm">Cadastre seus cartoes na aba Cartoes.</p>'}
        </div>
      </div>`;
    const labels = d.projection.map(p => mesLabel(p.month));
    makeChart('chart-balance', 'line', labels, [{ label: 'Saldo', data: d.projection.map(p => p.balance), borderColor: '#B9502C', backgroundColor: 'rgba(185,80,44,.12)', fill: true, tension: .3 }]);
    makeChart('chart-io', 'bar', labels, [
      { label: 'Entradas', data: d.projection.map(p => p.income), backgroundColor: '#2F7A55' },
      { label: 'Saidas', data: d.projection.map(p => p.expense), backgroundColor: '#B23A2E' }
    ]);
    document.querySelectorAll('[data-goproj]').forEach(el => el.addEventListener('click', () => { state.projId = el.dataset.goproj; state.vidaTab = 'info'; go('vida'); }));
  };

  function cardBar(c) {
    const col = c.usagePct >= 80 ? '#B23A2E' : c.usagePct >= 60 ? '#B07A20' : '#2F7A55';
    return `<div class="bg-panel2 rounded-xl p-4 border border-line">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${esc(c.color)}"></span><b>${esc(c.name)}</b></div>
        <span class="chip">${esc(c.bank || '')}</span>
      </div>
      <div class="progress mb-2"><div style="width:${c.usagePct}%;background:${col}"></div></div>
      <div class="flex justify-between text-xs text-muted">
        <span>Disponivel: <b class="text-good">${brl(c.available)}</b></span>
        <span>Fatura atual: <b class="text-ink">${brl(c.nextInvoice)}</b></span>
      </div>
    </div>`;
  }

  function makeChart(id, type, labels, datasets) {
    const el = document.getElementById(id); if (!el) return;
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart(el, {
      type, data: { labels, datasets },
      options: {
        responsive: true, plugins: { legend: { labels: { color: '#6F6252' } } },
        scales: { x: { ticks: { color: '#A2957F' }, grid: { color: '#EADFCE' } }, y: { ticks: { color: '#A2957F', callback: v => 'R$' + (v / 1000).toFixed(0) + 'k' }, grid: { color: '#EADFCE' } } }
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
      <div class="progress mb-2"><div style="width:${c.usagePct}%;background:${c.usagePct >= 80 ? '#B23A2E' : c.usagePct >= 60 ? '#B07A20' : '#2F7A55'}"></div></div>
      <div class="flex justify-between text-xs text-muted"><span>Fecha dia ${c.closingDay}</span><span>Vence dia ${c.dueDay}</span></div>
    </div>`;
  }
  function cardForm(card) {
    formModal(card ? 'Editar cartao' : 'Novo cartao', [
      { name: 'name', label: 'Nome do cartao', required: true, value: card?.name, placeholder: 'Ex: Nubank' },
      { name: 'bank', label: 'Banco emissor', value: card?.bank, placeholder: 'Ex: Nu Pagamentos' },
      { name: 'limitTotal', label: 'Limite total (R$)', type: 'number', step: '0.01', required: true, value: card?.limitTotal },
      { name: 'color', label: 'Cor', type: 'color', value: card?.color || '#B9502C' },
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
      <div class="progress mb-2"><div style="width:${pct}%;background:#2F7A55"></div></div>
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
        <td><button class="badge ${it.settled ? 'bg-good/20 text-good' : 'bg-panel2 text-muted'}" data-rec="${it.number}">${it.settled ? '✓ Recebido' : 'Marcar recebido'}</button></td></tr>`).join('')}
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
          <td>${l.overdue > 0 ? '<span class="badge bg-bad/20 text-bad">Atrasado</span>' : l.pending === 0 ? '<span class="badge bg-good/20 text-good">Quitado</span>' : '<span class="badge bg-panel2 text-muted">Em dia</span>'}</td>
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
        ${evs.slice(0, 4).map(e => `<div class="truncate ${e.type === 'income' ? 'text-good' : 'text-bad'}" title="${esc(e.label)} - ${brl(e.amount)}">${e.type === 'income' ? '▲' : '▼'} ${brl(e.amount)}</div>`).join('')}
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
            <b class="${e.type === 'income' ? 'text-good' : 'text-bad'}">${e.type === 'income' ? '+' : '-'}${brl(e.amount)}</b></div>`).join('') : '<p class="text-muted text-sm">Sem eventos.</p>'}
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
          <td class="${p.balance >= 0 ? 'text-good' : 'text-bad'}"><b>${brl(p.balance)}</b> ${p.risk ? '<span class="badge bg-bad/20 text-bad ml-1">risco</span>' : ''}</td>
        </tr>`).join('')}</tbody></table>
      </div>`;
    const labels = proj.map(p => mesLabel(p.month));
    makeChart('chart-flux', 'line', labels, [
      { label: 'Saldo acumulado', data: proj.map(p => p.balance), borderColor: '#B9502C', backgroundColor: 'rgba(185,80,44,.12)', fill: true, tension: .3 },
      { label: 'Entradas', data: proj.map(p => p.income), borderColor: '#2F7A55', tension: .3 },
      { label: 'Saidas', data: proj.map(p => p.expense), borderColor: '#B23A2E', tension: .3 },
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
          <td>${r.type === 'income' ? '<span class="badge bg-good/20 text-good">Receita</span>' : '<span class="badge bg-bad/20 text-bad">Despesa</span>'}</td>
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
      } catch (e) { $('#imp-result').innerHTML = `<div class="card p-4 text-bad">${esc(e.message)}</div>`; }
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
          <td>${esc(it.description)} ${it.duplicate ? '<span class="badge bg-warn/20 text-warn">ja cadastrado</span>' : ''}</td><td><span class="chip">${esc(it.category)}</span></td>
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
    const palette = ['#B9502C', '#C4622F', '#2F7A55', '#B07A20', '#B23A2E', '#8B5E3C', '#C97B5A', '#5B8C7B', '#C9A227'];
    new Chart($('#chart-cat'), { type: 'doughnut', data: { labels: cats.map(c => c[0]), datasets: [{ data: cats.map(c => c[1]), backgroundColor: palette }] }, options: { plugins: { legend: { position: 'right', labels: { color: '#6F6252' } } } } });
    makeChart('chart-cards', 'bar', rep.cardUsage.map(c => c.name), [{ label: 'Total', data: rep.cardUsage.map(c => c.total), backgroundColor: '#B9502C' }]);
    makeChart('chart-rep-flux', 'bar', rep.cashflow.map(p => mesLabel(p.month)), [
      { label: 'Entradas', data: rep.cashflow.map(p => p.income), backgroundColor: '#2F7A55' },
      { label: 'Saidas', data: rep.cashflow.map(p => p.expense), backgroundColor: '#B23A2E' }
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
      ${r.worstMonth.balance < 0 ? '<div class="card p-4 mb-5 border-bad/40 bg-bad/10 text-bad">⚠️ Atencao: esta compra deixa seu saldo projetado negativo em algum mes.</div>' : '<div class="card p-4 mb-5 border-good/40 bg-good/10 text-good">✅ Esta compra cabe no seu fluxo projetado.</div>'}
      <div class="card p-5"><h3 class="font-semibold mb-3">Saldo projetado: antes x depois</h3><canvas id="chart-sim" height="90"></canvas></div>`;
    makeChart('chart-sim', 'line', r.before.map(p => mesLabel(p.month)), [
      { label: 'Antes', data: r.before.map(p => p.balance), borderColor: '#A2957F', tension: .3 },
      { label: 'Depois da compra', data: r.after.map(p => p.balance), borderColor: '#B9502C', backgroundColor: 'rgba(185,80,44,.12)', fill: true, tension: .3 }
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
          <p class="text-sm text-muted mb-1">Usuario: <b class="text-ink">${esc(state.email)}</b></p>
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


  // ================= PROJETO DE VIDA =================
  const VIDA_TABS = [['info', 'Informacoes'], ['simulador', 'Simulador'], ['fundo', 'Fundo'], ['compras', 'Compras'], ['checklist', 'Checklist'], ['cronograma', 'Cronograma'], ['metas', 'Metas'], ['inspiracao', 'Inspiracao']];
  const genId = () => Math.random().toString(36).slice(2, 10);
  const dbr = iso => iso ? iso.split('-').reverse().join('/') : '—';

  async function saveProj() { try { await api('PUT', '/projects/' + state.proj.id, state.proj); go('vida'); } catch (e) { toast(e.message, 'err'); } }
  function newProject() {
    formModal('Novo projeto', [{ name: 'name', label: 'Nome do projeto', required: true, col: 'full', placeholder: 'Ex: Morar Sozinha' }],
      async v => { const p = await api('POST', '/projects', v); state.projId = p.id; state.vidaTab = 'info'; closeModal(); toast('Projeto criado', 'ok'); go('vida'); });
  }

  PAGES.vida = async function () {
    const list = await api('GET', '/projects');
    const c = $('#content');
    if (!list.length) {
      c.innerHTML = pageHeader('Projeto de Vida', 'Transforme sonhos em projetos: plano financeiro, cronograma e checklist', '<button class="btn btn-primary" id="np">+ Novo projeto</button>')
        + emptyState('Nenhum projeto ainda. Crie o primeiro (ex.: Morar Sozinha).');
      $('#np').addEventListener('click', newProject);
      return;
    }
    if (!state.projId || !list.find(p => p.id === state.projId)) state.projId = list[0].id;
    const full = await api('GET', '/projects/' + state.projId);
    const p = full.project; state.proj = p; const cp = full.computed; const alerts = full.alerts;
    if (!state.vidaTab) state.vidaTab = 'info';
    const opts = list.map(x => `<option value="${x.id}" ${x.id === state.projId ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const ac = { high: 'border-bad/40 bg-bad/10 text-bad', medium: 'border-warn/40 bg-warn/10 text-warn', low: 'border-line bg-panel2' };
    c.innerHTML = pageHeader('Projeto de Vida', p.description || 'Planejamento do seu objetivo',
      `<select class="input w-auto" id="proj-sel">${opts}</select> <button class="btn btn-primary" id="np">+ Novo</button> <button class="btn btn-ghost" id="dp">🗑️</button>`)
      + `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        ${statCard('Objetivo', esc(p.name), p.targetDate ? ('ate ' + dbr(p.targetDate)) : 'sem data', 'text-accent2')}
        ${statCard('Valor necessario', brl(cp.target), 'meta total')}
        ${statCard('Ja economizado', brl(cp.saldo), cp.percent + '% da meta', 'text-good')}
        ${statCard('Falta economizar', brl(cp.restante), cp.monthsLeft != null ? ('em ' + cp.monthsLeft + ' meses') : '', 'text-warn')}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        ${statCard('Economizar/mes', brl(cp.monthlyNeeded), 'para bater a meta', 'text-accent')}
        ${statCard('Tempo restante', cp.daysLeft != null ? (cp.daysLeft + ' dias') : '—', cp.monthsLeft != null ? (cp.monthsLeft + ' meses') : '')}
        ${statCard('Compras', cp.shopDone + '/' + cp.shopTotal, cp.shopPercent + '% feitas · pago ' + brl(cp.shopPaid))}
        ${statCard('Checklist', cp.checkPercent + '%', cp.checkDone + '/' + cp.checklistTotal + ' itens')}
      </div>
      <div class="card p-3 mb-4"><div class="progress"><div style="width:${cp.percent}%;background:#2F7A55"></div></div>
        <div class="text-xs text-muted mt-1">${cp.percent}% da meta financeira · Prioridade ${esc(p.priority)} · Status ${esc(p.status)}</div></div>
      ${alerts.length ? `<div class="space-y-2 mb-4">${alerts.map(a => `<div class="border rounded-lg px-3 py-2 text-sm ${ac[a.level]}">${esc(a.text)}</div>`).join('')}</div>` : ''}
      <div class="flex gap-1 flex-wrap mb-4">${VIDA_TABS.map(([k, l]) => `<button class="btn ${k === state.vidaTab ? 'btn-primary' : 'btn-ghost'}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="vida-sub"></div>`;
    $('#proj-sel').addEventListener('change', e => { state.projId = e.target.value; state.vidaTab = 'info'; go('vida'); });
    $('#np').addEventListener('click', newProject);
    $('#dp').addEventListener('click', () => confirmModal('Excluir o projeto "' + p.name + '" e todo o seu conteudo?', async () => { await api('DELETE', '/projects/' + p.id); state.projId = null; toast('Excluido', 'ok'); go('vida'); }));
    document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.vidaTab = b.dataset.tab; renderVidaSub(cp); }));
    renderVidaSub(cp);
  };

  function renderVidaSub(cp) {
    const p = state.proj; const box = $('#vida-sub'); if (!box) return;
    const T = state.vidaTab;
    if (T === 'info') box.innerHTML = subInfo(p);
    else if (T === 'simulador') box.innerHTML = subSimulador(p, cp);
    else if (T === 'fundo') box.innerHTML = subFundo(p, cp);
    else if (T === 'compras') box.innerHTML = subCompras(p);
    else if (T === 'checklist') box.innerHTML = subChecklist(p);
    else if (T === 'cronograma') box.innerHTML = subCronograma(p);
    else if (T === 'metas') box.innerHTML = subMetas(p);
    else if (T === 'inspiracao') box.innerHTML = subInspiracao(p);
    bindVidaSub(cp);
  }

  // ----- Informacoes -----
  function subInfo(p) {
    return `<div class="card p-5 grid md:grid-cols-2 gap-4">
      <div class="md:col-span-2"><label class="label">Nome</label><input class="input" id="i-name" value="${esc(p.name)}"></div>
      <div class="md:col-span-2"><label class="label">Descricao</label><textarea class="input" id="i-desc" rows="2">${esc(p.description || '')}</textarea></div>
      <div><label class="label">Data de inicio</label><input class="input" type="date" id="i-start" value="${p.startDate || ''}"></div>
      <div><label class="label">Data prevista de conclusao</label><input class="input" type="date" id="i-target" value="${p.targetDate || ''}"></div>
      <div><label class="label">Valor total necessario (R$)</label><input class="input" type="number" step="0.01" id="i-amount" value="${p.targetAmount || 0}"></div>
      <div><label class="label">Valor inicial do fundo (R$)</label><input class="input" type="number" step="0.01" id="i-initial" value="${(p.fund && p.fund.initial) || 0}"></div>
      <div><label class="label">Prioridade</label><select class="input" id="i-prio">${['Alta', 'Media', 'Baixa'].map(o => `<option ${p.priority === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div><label class="label">Status</label><select class="input" id="i-status">${['Planejamento', 'Em andamento', 'Concluido', 'Pausado'].map(o => `<option ${p.status === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div class="md:col-span-2 flex justify-end"><button class="btn btn-primary" id="i-save">Salvar informacoes</button></div>
    </div>`;
  }

  // ----- Simulador (estilo de vida) -----
  function subSimulador(p, cp) {
    const rows = (p.lifestyle || []).map(i => `<tr><td>${esc(i.name)}</td><td>${brl(i.amount)}</td><td class="text-right"><button class="chip" data-lsdel="${i.id}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="3" class="text-muted text-center py-4">Nenhum item cadastrado</td></tr>';
    return `<div class="card p-5">
      <div class="flex justify-between items-center mb-3"><h3 class="font-semibold">Custo do novo estilo de vida</h3><button class="btn btn-primary" id="ls-add">+ Item</button></div>
      <table><thead><tr><th>Item</th><th>Valor/mes</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="grid grid-cols-3 gap-4 mt-4">
        ${statCard('Custo mensal', brl(cp.lifestyleMonthly))}
        ${statCard('Custo anual', brl(cp.lifestyleAnnual))}
        ${statCard('Renda liquida recomendada', brl(cp.recommendedIncome), 'p/ manter com folga (custo ~70%)', 'text-good')}
      </div></div>`;
  }

  // ----- Fundo -----
  function subFundo(p, cp) {
    const f = p.fund || { initial: 0, entries: [] };
    const rows = (f.entries || []).slice().reverse().map(e => `<tr><td>${dbr(e.date)}</td><td><span class="chip">${e.type}</span></td><td class="${e.type === 'resgate' ? 'text-bad' : 'text-good'}">${brl(e.amount)}</td><td>${esc(e.note || '')}</td><td class="text-right"><button class="chip" data-fdel="${e.id}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="5" class="text-muted text-center py-4">Nenhum aporte ainda</td></tr>';
    return `<div class="card p-5">
      <div class="flex justify-between items-center mb-3"><h3 class="font-semibold">Fundo do projeto</h3><div class="flex gap-2"><button class="btn btn-primary" id="ap-add">+ Aporte</button><button class="btn btn-ghost" id="rg-add">- Resgate</button></div></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        ${statCard('Valor inicial', brl(f.initial))}
        ${statCard('Aportes', brl(cp.aportes), null, 'text-good')}
        ${statCard('Resgates', brl(cp.resgates), null, 'text-bad')}
        ${statCard('Saldo atual', brl(cp.saldo), cp.percent + '% da meta', 'text-accent2')}
      </div>
      <canvas id="fund-chart" height="90"></canvas>
      <table class="mt-4"><thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Obs</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  // ----- Compras -----
  function subCompras(p) {
    const rows = (p.shopping || []).map(i => `<tr>
      <td><b>${esc(i.name)}</b></td><td><span class="chip">${esc(i.category || '-')}</span></td><td>${esc(i.priority || '-')}</td>
      <td>${brl(i.estimated)}</td><td class="text-good">${brl(i.paid)}</td><td>${esc(i.store || '')}</td><td>${dbr(i.dueDate)}</td>
      <td><span class="badge ${(i.status === 'Comprado' || i.status === 'Concluido') ? 'bg-good/20 text-good' : 'bg-panel2 text-muted'}">${esc(i.status || 'Pendente')}</span></td>
      <td class="text-right whitespace-nowrap"><button class="chip" data-shop-done="${i.id}">✓</button> <button class="chip" data-shop-edit="${i.id}">✏️</button> <button class="chip" data-shop-del="${i.id}">🗑️</button></td>
    </tr>`).join('') || '<tr><td colspan="9" class="text-muted text-center py-4">Nenhum item</td></tr>';
    return `<div class="card overflow-hidden">
      <div class="flex justify-between items-center p-4"><h3 class="font-semibold">Planejamento de compras</h3><button class="btn btn-primary" id="shop-add">+ Item</button></div>
      <table><thead><tr><th>Item</th><th>Categoria</th><th>Prior.</th><th>Estimado</th><th>Pago</th><th>Loja</th><th>Prazo</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  // ----- Checklist -----
  function subChecklist(p) {
    const next = { 'Pendente': 'Em andamento', 'Em andamento': 'Concluido', 'Concluido': 'Pendente' };
    const col = { 'Pendente': 'bg-panel2 text-muted', 'Em andamento': 'bg-warn/20 text-warn', 'Concluido': 'bg-good/20 text-good' };
    const rows = (p.checklist || []).map(i => `<tr><td>${esc(i.text)}</td>
      <td><button class="badge ${col[i.status] || col.Pendente}" data-chk="${i.id}">${esc(i.status || 'Pendente')}</button></td>
      <td class="text-right"><button class="chip" data-chk-del="${i.id}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="3" class="text-muted text-center py-4">Nenhum item</td></tr>';
    return `<div class="card overflow-hidden">
      <div class="flex justify-between items-center p-4"><h3 class="font-semibold">Checklist da mudanca</h3><button class="btn btn-primary" id="chk-add">+ Item</button></div>
      <table><thead><tr><th>Tarefa</th><th>Status (clique p/ mudar)</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  // ----- Cronograma -----
  function subCronograma(p) {
    const items = (p.timeline || []).slice().sort((a, b) => (a.year + '').localeCompare(b.year + ''));
    const byYear = {};
    items.forEach(i => { (byYear[i.year] = byYear[i.year] || []).push(i); });
    const years = Object.keys(byYear).sort();
    const body = years.length ? years.map(y => `<div class="mb-4"><h4 class="font-bold text-accent2 mb-2">${esc(y)}</h4>
      ${byYear[y].map(i => `<div class="flex items-center justify-between border-b border-line/50 py-1.5 text-sm">
        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" data-tl="${i.id}" ${i.done ? 'checked' : ''}> <span class="${i.done ? 'line-through text-muted' : ''}">${esc(i.text)}</span></label>
        <button class="chip" data-tl-del="${i.id}">🗑️</button></div>`).join('')}</div>`).join('') : '<p class="text-muted text-sm">Nenhuma etapa. Adicione a primeira.</p>';
    return `<div class="card p-5"><div class="flex justify-between items-center mb-3"><h3 class="font-semibold">Cronograma</h3><button class="btn btn-primary" id="tl-add">+ Etapa</button></div>${body}</div>`;
  }

  // ----- Metas -----
  function subMetas(p) {
    const rows = (p.goals || []).map(g => `<tr><td><b>${esc(g.text)}</b></td><td>${dbr(g.deadline)}</td>
      <td><div class="progress" style="width:90px"><div style="width:${g.percent || 0}%;background:#B9502C"></div></div><span class="text-xs text-muted">${g.percent || 0}%</span></td>
      <td><span class="badge ${g.status === 'Concluido' ? 'bg-good/20 text-good' : 'bg-panel2 text-muted'}">${esc(g.status || 'Pendente')}</span></td>
      <td class="text-right whitespace-nowrap"><button class="chip" data-goal-edit="${g.id}">✏️</button> <button class="chip" data-goal-del="${g.id}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="5" class="text-muted text-center py-4">Nenhuma meta</td></tr>';
    return `<div class="card overflow-hidden"><div class="flex justify-between items-center p-4"><h3 class="font-semibold">Metas mensais</h3><button class="btn btn-primary" id="goal-add">+ Meta</button></div>
      <table><thead><tr><th>Meta</th><th>Prazo</th><th>Progresso</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ----- Inspiracao -----
  function subInspiracao(p) {
    const cards = (p.inspiration || []).map(i => {
      let inner = '';
      if (i.type === 'image') inner = `<img src="${esc(i.content)}" class="w-full h-40 object-cover rounded-lg mb-2" onerror="this.style.display='none'">`;
      else if (i.type === 'link') inner = `<a href="${esc(i.content)}" target="_blank" class="text-accent2 underline break-all text-sm">${esc(i.content)}</a>`;
      return `<div class="card p-3">${inner}${i.note ? `<div class="text-sm mt-1">${esc(i.note)}</div>` : ''}
        <div class="text-right mt-2"><button class="chip" data-insp-del="${i.id}">🗑️</button></div></div>`;
    }).join('') || emptyState('Mural vazio. Adicione links, imagens (por URL) ou anotacoes.');
    return `<div><div class="flex justify-between items-center mb-3"><h3 class="font-semibold">Mural de inspiracao</h3><button class="btn btn-primary" id="insp-add">+ Adicionar</button></div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">${cards}</div></div>`;
  }

  // ----- Bindings de todas as subsecoes -----
  function bindVidaSub(cp) {
    const p = state.proj;
    // Info
    if ($('#i-save')) $('#i-save').addEventListener('click', () => {
      p.name = $('#i-name').value || p.name; p.description = $('#i-desc').value;
      p.startDate = $('#i-start').value; p.targetDate = $('#i-target').value;
      p.targetAmount = Number($('#i-amount').value) || 0;
      if (!p.fund) p.fund = { initial: 0, entries: [] }; p.fund.initial = Number($('#i-initial').value) || 0;
      p.priority = $('#i-prio').value; p.status = $('#i-status').value;
      toast('Salvo', 'ok'); saveProj();
    });
    // Simulador
    if ($('#ls-add')) $('#ls-add').addEventListener('click', () => formModal('Novo item de custo', [
      { name: 'name', label: 'Item', required: true, placeholder: 'Ex: Aluguel' }, { name: 'amount', label: 'Valor/mes (R$)', type: 'number', step: '0.01', required: true }
    ], async v => { (p.lifestyle = p.lifestyle || []).push({ id: genId(), name: v.name, amount: Number(v.amount) || 0 }); closeModal(); saveProj(); }));
    document.querySelectorAll('[data-lsdel]').forEach(b => b.addEventListener('click', () => { p.lifestyle = p.lifestyle.filter(x => x.id !== b.dataset.lsdel); saveProj(); }));
    // Fundo
    const fundForm = (type) => formModal(type === 'aporte' ? 'Novo aporte' : 'Novo resgate', [
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', required: true },
      { name: 'date', label: 'Data', type: 'date', value: new Date().toISOString().slice(0, 10) },
      { name: 'note', label: 'Observacao', placeholder: 'opcional' },
      { name: 'affectCashflow', label: 'Lancar no Fluxo de Caixa?', type: 'select', options: [{ value: '', label: 'Nao' }, { value: '1', label: 'Sim' }] }
    ], async v => { await api('POST', '/projects/' + p.id + '/fund', { type, amount: v.amount, date: v.date, note: v.note, affectCashflow: !!v.affectCashflow }); closeModal(); toast('Registrado', 'ok'); go('vida'); });
    if ($('#ap-add')) $('#ap-add').addEventListener('click', () => fundForm('aporte'));
    if ($('#rg-add')) $('#rg-add').addEventListener('click', () => fundForm('resgate'));
    document.querySelectorAll('[data-fdel]').forEach(b => b.addEventListener('click', () => { p.fund.entries = p.fund.entries.filter(x => x.id !== b.dataset.fdel); saveProj(); }));
    if ($('#fund-chart')) {
      const f = p.fund || { initial: 0, entries: [] }; let run = Number(f.initial || 0); const labels = ['inicio']; const dd = [run];
      (f.entries || []).forEach(e => { run += (e.type === 'resgate' ? -1 : 1) * Number(e.amount || 0); labels.push((e.date || '').slice(5)); dd.push(Math.round(run * 100) / 100); });
      makeChart('fund-chart', 'line', labels, [{ label: 'Saldo do fundo', data: dd, borderColor: '#2F7A55', backgroundColor: 'rgba(47,122,85,.12)', fill: true, tension: .3 }]);
    }
    // Compras
    const shopFields = (it) => [
      { name: 'name', label: 'Nome', required: true, col: 'full', value: it && it.name },
      { name: 'category', label: 'Categoria', type: 'select', value: it && it.category, options: ['Dormitorio', 'Sala', 'Cozinha', 'Banheiro', 'Lavanderia', 'Limpeza', 'Decoracao', 'Eletrodomesticos', 'Eletronicos', 'Utensilios', 'Organizacao', 'Outros'].map(o => ({ value: o, label: o })) },
      { name: 'priority', label: 'Prioridade', type: 'select', value: it && it.priority, options: ['Alta', 'Media', 'Baixa'].map(o => ({ value: o, label: o })) },
      { name: 'estimated', label: 'Valor estimado (R$)', type: 'number', step: '0.01', value: it && it.estimated },
      { name: 'paid', label: 'Valor pago (R$)', type: 'number', step: '0.01', value: it && it.paid },
      { name: 'store', label: 'Loja', value: it && it.store },
      { name: 'dueDate', label: 'Data prevista', type: 'date', value: it && it.dueDate },
      { name: 'status', label: 'Status', type: 'select', value: it && it.status, options: ['Pendente', 'Comprado'].map(o => ({ value: o, label: o })) },
      { name: 'notes', label: 'Observacoes', col: 'full', value: it && it.notes }
    ];
    if ($('#shop-add')) $('#shop-add').addEventListener('click', () => formModal('Novo item de compra', shopFields(), async v => { (p.shopping = p.shopping || []).push(Object.assign({ id: genId() }, v)); closeModal(); saveProj(); }));
    document.querySelectorAll('[data-shop-edit]').forEach(b => b.addEventListener('click', () => { const it = p.shopping.find(x => x.id === b.dataset.shopEdit); formModal('Editar item', shopFields(it), async v => { Object.assign(it, v); closeModal(); saveProj(); }); }));
    document.querySelectorAll('[data-shop-del]').forEach(b => b.addEventListener('click', () => { p.shopping = p.shopping.filter(x => x.id !== b.dataset.shopDel); saveProj(); }));
    document.querySelectorAll('[data-shop-done]').forEach(b => b.addEventListener('click', () => { const it = p.shopping.find(x => x.id === b.dataset.shopDone); it.status = 'Comprado'; if (!Number(it.paid)) it.paid = it.estimated; saveProj(); }));
    // Checklist
    const chkNext = { 'Pendente': 'Em andamento', 'Em andamento': 'Concluido', 'Concluido': 'Pendente' };
    if ($('#chk-add')) $('#chk-add').addEventListener('click', () => formModal('Novo item do checklist', [{ name: 'text', label: 'Tarefa', required: true, col: 'full' }], async v => { (p.checklist = p.checklist || []).push({ id: genId(), text: v.text, status: 'Pendente' }); closeModal(); saveProj(); }));
    document.querySelectorAll('[data-chk]').forEach(b => b.addEventListener('click', () => { const it = p.checklist.find(x => x.id === b.dataset.chk); it.status = chkNext[it.status || 'Pendente']; saveProj(); }));
    document.querySelectorAll('[data-chk-del]').forEach(b => b.addEventListener('click', () => { p.checklist = p.checklist.filter(x => x.id !== b.dataset.chkDel); saveProj(); }));
    // Cronograma
    if ($('#tl-add')) $('#tl-add').addEventListener('click', () => formModal('Nova etapa do cronograma', [{ name: 'year', label: 'Ano', value: new Date().getFullYear() }, { name: 'text', label: 'Etapa', required: true, col: 'full' }], async v => { (p.timeline = p.timeline || []).push({ id: genId(), year: v.year, text: v.text, done: false }); closeModal(); saveProj(); }));
    document.querySelectorAll('[data-tl]').forEach(b => b.addEventListener('change', () => { const it = p.timeline.find(x => x.id === b.dataset.tl); it.done = b.checked; saveProj(); }));
    document.querySelectorAll('[data-tl-del]').forEach(b => b.addEventListener('click', () => { p.timeline = p.timeline.filter(x => x.id !== b.dataset.tlDel); saveProj(); }));
    // Metas
    const goalFields = (g) => [
      { name: 'text', label: 'Meta', required: true, col: 'full', value: g && g.text },
      { name: 'deadline', label: 'Prazo', type: 'date', value: g && g.deadline },
      { name: 'percent', label: 'Progresso (%)', type: 'number', min: 0, value: (g && g.percent) || 0 },
      { name: 'status', label: 'Status', type: 'select', value: g && g.status, options: ['Pendente', 'Em andamento', 'Concluido'].map(o => ({ value: o, label: o })) }
    ];
    if ($('#goal-add')) $('#goal-add').addEventListener('click', () => formModal('Nova meta', goalFields(), async v => { (p.goals = p.goals || []).push(Object.assign({ id: genId() }, v, { percent: Number(v.percent) || 0 })); closeModal(); saveProj(); }));
    document.querySelectorAll('[data-goal-edit]').forEach(b => b.addEventListener('click', () => { const g = p.goals.find(x => x.id === b.dataset.goalEdit); formModal('Editar meta', goalFields(g), async v => { Object.assign(g, v, { percent: Number(v.percent) || 0 }); closeModal(); saveProj(); }); }));
    document.querySelectorAll('[data-goal-del]').forEach(b => b.addEventListener('click', () => { p.goals = p.goals.filter(x => x.id !== b.dataset.goalDel); saveProj(); }));
    // Inspiracao
    if ($('#insp-add')) $('#insp-add').addEventListener('click', () => formModal('Adicionar ao mural', [
      { name: 'type', label: 'Tipo', type: 'select', options: [{ value: 'link', label: 'Link' }, { value: 'image', label: 'Imagem (URL)' }, { value: 'note', label: 'Anotacao' }] },
      { name: 'content', label: 'Link ou URL da imagem', col: 'full', placeholder: 'https://... (deixe vazio se for so anotacao)' },
      { name: 'note', label: 'Anotacao / descricao', col: 'full' }
    ], async v => { (p.inspiration = p.inspiration || []).push({ id: genId(), type: v.type, content: v.content, note: v.note }); closeModal(); saveProj(); }));
    document.querySelectorAll('[data-insp-del]').forEach(b => b.addEventListener('click', () => { p.inspiration = p.inspiration.filter(x => x.id !== b.dataset.inspDel); saveProj(); }));
  }



  // ================= HUB DE PROJETOS =================
  function hubCard(key, title, sub, desc, icon, color) {
    return `<div class="card p-6 cursor-pointer hover:border-accent transition" data-hub="${key}" style="border-top:3px solid ${color}">
      <div class="flex justify-between items-start mb-4">
        <span class="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style="background:${color}33">${icon}</span>
        <span class="badge bg-good/20 text-good">ATIVO</span>
      </div>
      <h3 class="text-xl font-bold">${esc(title)}</h3>
      <p class="text-accent2 text-sm mb-3">${esc(sub)}</p>
      <p class="text-muted text-sm mb-5 leading-relaxed">${esc(desc)}</p>
      <div class="text-accent font-semibold text-sm">Acessar →</div>
    </div>`;
  }
  function renderHub() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="min-h-screen">
        <header class="flex items-center justify-between px-6 py-4 border-b border-line bg-sand">
          <div class="flex items-center gap-2 font-bold"><span class="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">🗂️</span> Meus Projetos</div>
          <div class="flex items-center gap-4 text-sm text-muted">
            <span class="hidden md:inline">${esc(state.email || '')}</span>
            <button class="btn btn-ghost" id="hub-logout">Sair</button>
          </div>
        </header>
        <div class="max-w-6xl mx-auto px-6 py-14 fade-in">
          <h1 class="text-4xl md:text-5xl font-display mb-3">Qual projeto voce quer abrir?</h1>
          <p class="text-muted mb-10">Cada projeto abre o seu proprio painel, com dados e telas independentes.</p>
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${hubCard('radar', 'Radar Financeiro', 'Controle financeiro pessoal', 'Cartoes, parcelamentos, emprestimos, fluxo de caixa projetado, importacao de faturas, relatorios e Projeto de Vida.', '📡', '#B9502C')}
            ${hubCard('eventos', 'Eventos', 'Organizacao de eventos', 'Eventos seus ou de clientes: orcamento, fornecedores, convidados, checklist com prazos e honorarios.', '🎉', '#C4622F')}
          </div>
        </div>
      </div>`;
    $('#hub-logout').addEventListener('click', logout);
    document.querySelectorAll('[data-hub]').forEach(c => c.addEventListener('click', () => openApp(c.dataset.hub)));
  }
  function openApp(key) {
    state.app = key;
    renderShell();
    go(key === 'eventos' ? 'eventos' : 'dashboard');
  }

  // ================= EVENTOS =================
  const EV_TABS = [['info', 'Informacoes'], ['fornecedores', 'Fornecedores'], ['convidados', 'Convidados'], ['checklist', 'Checklist'], ['honorarios', 'Honorarios']];
  const EV_CATS = ['Buffet', 'Local', 'Decoracao', 'Fotografia', 'Musica/DJ', 'Bolo/Doces', 'Convites', 'Vestuario/Beleza', 'Transporte', 'Outros'];

  async function saveEv() { try { await api('PUT', '/events/' + state.ev.id, state.ev); go('eventos'); } catch (e) { toast(e.message, 'err'); } }
  function newEvent() {
    formModal('Novo evento', [{ name: 'name', label: 'Nome do evento', required: true, col: 'full', placeholder: 'Ex: Casamento da Ana' }],
      async v => { const e = await api('POST', '/events', v); state.evId = e.id; state.evTab = 'info'; closeModal(); toast('Evento criado', 'ok'); go('eventos'); });
  }
  function evCard(e) {
    const meta = [esc(e.type || ''), e.date ? dbr(e.date) : '', esc(e.venue || 'Local a definir')].filter(Boolean).join(' · ');
    return `<div class="card p-6 cursor-pointer hover:border-accent transition" data-ev="${e.id}">
      <div class="flex justify-between items-start mb-1 gap-3">
        <h3 class="text-2xl font-display leading-tight">${esc(e.name)}</h3>
        <span class="badge" style="background:#FBE7DA;color:#B9502C">${e.owner === 'Cliente' ? 'Cliente' : 'Meu'}</span>
      </div>
      <p class="text-muted text-sm mb-5">${meta}</p>
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="stat-box"><div class="stat-label">Orcamento</div><div class="stat-value">${brl(e.budget)}</div></div>
        <div class="stat-box accent"><div class="stat-label">A pagar</div><div class="stat-value text-accent">${brl(e.toPay)}</div></div>
      </div>
      <div class="flex justify-between text-sm mb-1"><span class="text-muted">Checklist</span><span class="text-muted">${e.checkPercent}%</span></div>
      <div class="progress mb-4"><div style="width:${e.checkPercent}%;background:#B9502C"></div></div>
      <div class="flex justify-between items-center pt-3 border-t border-line">
        <span class="text-sm text-muted">${e.confirmedPeople} confirmados</span>
        ${e.daysLeft != null ? `<span class="badge bg-panel2">${e.daysLeft} dias</span>` : ''}
      </div>
    </div>`;
  }

  PAGES.eventos = async function () {
    const list = await api('GET', '/events');
    const c = $('#content');
    if (!state.evId) {
      if (!state.evFilter) state.evFilter = 'todos';
      let arr = list.slice();
      if (state.evFilter === 'meus') arr = arr.filter(x => x.owner !== 'Cliente');
      if (state.evFilter === 'clientes') arr = arr.filter(x => x.owner === 'Cliente');
      arr.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
      c.innerHTML = `
        <div class="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 class="text-4xl md:text-5xl font-display mb-3">Eventos</h1>
            <p class="text-muted max-w-md leading-relaxed">Os seus e os de clientes — orcamento, fornecedores, convidados e checklist, tudo com calma num so lugar.</p>
          </div>
          <button class="btn btn-primary" id="ne">+ Novo evento</button>
        </div>
        <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div class="flex gap-2">
            <button class="chip ${state.evFilter === 'todos' ? 'chip-active' : ''}" data-filt="todos">Todos · ${list.length}</button>
            <button class="chip ${state.evFilter === 'meus' ? 'chip-active' : ''}" data-filt="meus">Meus</button>
            <button class="chip ${state.evFilter === 'clientes' ? 'chip-active' : ''}" data-filt="clientes">De clientes</button>
          </div>
          <span class="text-sm text-muted">Ordenar por data ↓</span>
        </div>
        ${arr.length ? `<div class="grid md:grid-cols-2 gap-6 mb-6">${arr.map(evCard).join('')}</div>` : ''}
        <div class="add-card" id="ne2">+ &nbsp; Adicionar um novo evento</div>`;
      $('#ne').addEventListener('click', newEvent);
      $('#ne2').addEventListener('click', newEvent);
      document.querySelectorAll('[data-filt]').forEach(b => b.addEventListener('click', () => { state.evFilter = b.dataset.filt; go('eventos'); }));
      document.querySelectorAll('[data-ev]').forEach(el => el.addEventListener('click', () => { state.evId = el.dataset.ev; state.evTab = 'info'; go('eventos'); }));
      return;
    }
    const full = await api('GET', '/events/' + state.evId);
    const e = full.event; state.ev = e; const ce = full.computed; const alerts = full.alerts;
    if (!state.evTab) state.evTab = 'info';
    const tabs = EV_TABS.filter(t => t[0] !== 'honorarios' || e.owner === 'Cliente');
    if (state.evTab === 'honorarios' && e.owner !== 'Cliente') state.evTab = 'info';
    const ac = { high: 'border-bad/40 bg-bad/10 text-bad', medium: 'border-warn/40 bg-warn/10 text-warn', low: 'border-line bg-panel2' };
    c.innerHTML = pageHeader(e.name, [e.type, e.date ? dbr(e.date) + (e.time ? ' ' + e.time : '') : '', e.venue].filter(Boolean).join(' · '),
      `<button class="btn btn-ghost" id="ev-back">← Eventos</button> <button class="btn btn-ghost" id="ev-del">🗑️</button>`)
      + `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        ${statCard('Dias restantes', ce.daysLeft != null ? ce.daysLeft : '—', e.date ? dbr(e.date) : 'sem data', 'text-accent2')}
        ${statCard('Orcamento', brl(ce.budget), (ce.overBudget ? 'ESTOUROU ' : 'sobra ') + brl(Math.abs(ce.budgetLeft)), ce.overBudget ? 'text-bad' : 'text-ink')}
        ${statCard('Contratado', brl(ce.contracted), 'pago ' + brl(ce.paid))}
        ${statCard('A pagar', brl(ce.toPay), null, 'text-warn')}
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        ${statCard('Pessoas confirmadas', ce.confirmedPeople, 'de ' + ce.invitedPeople + ' convidadas', 'text-good')}
        ${statCard('Sem resposta', ce.pendingGuests, ce.refusedGuests + ' recusaram')}
        ${statCard('Checklist', ce.checkPercent + '%', ce.checkDone + '/' + ce.checklistTotal + (ce.overdueTasks ? ' · ' + ce.overdueTasks + ' atrasada(s)' : ''), ce.overdueTasks ? 'text-bad' : 'text-ink')}
        ${e.owner === 'Cliente' ? statCard('Honorarios a receber', brl(ce.feeToReceive), 'de ' + brl(ce.feeTotal), 'text-accent') : statCard('Status', esc(e.status), 'evento proprio')}
      </div>
      ${alerts.length ? `<div class="space-y-2 mb-4">${alerts.map(a => `<div class="border rounded-lg px-3 py-2 text-sm ${ac[a.level]}">${esc(a.text)}</div>`).join('')}</div>` : ''}
      <div class="flex gap-1 flex-wrap mb-4">${tabs.map(([k, l]) => `<button class="btn ${k === state.evTab ? 'btn-primary' : 'btn-ghost'}" data-evtab="${k}">${l}</button>`).join('')}</div>
      <div id="ev-sub"></div>`;
    $('#ev-back').addEventListener('click', () => { state.evId = null; go('eventos'); });
    $('#ev-del').addEventListener('click', () => confirmModal('Excluir o evento "' + e.name + '" e tudo dele?', async () => { await api('DELETE', '/events/' + e.id); state.evId = null; toast('Excluido', 'ok'); go('eventos'); }));
    document.querySelectorAll('[data-evtab]').forEach(b => b.addEventListener('click', () => { state.evTab = b.dataset.evtab; renderEvSub(ce); }));
    renderEvSub(ce);
  };

  function renderEvSub(ce) {
    const e = state.ev; const box = $('#ev-sub'); if (!box) return;
    const T = state.evTab;
    if (T === 'info') box.innerHTML = subEvInfo(e);
    else if (T === 'fornecedores') box.innerHTML = subEvVendors(e);
    else if (T === 'convidados') box.innerHTML = subEvGuests(e, ce);
    else if (T === 'checklist') box.innerHTML = subEvCheck(e);
    else if (T === 'honorarios') box.innerHTML = subEvFee(e, ce);
    bindEvSub(ce);
  }

  function subEvInfo(e) {
    const isCli = e.owner === 'Cliente';
    return `<div class="card p-5 grid md:grid-cols-2 gap-4">
      <div class="md:col-span-2"><label class="label">Nome do evento</label><input class="input" id="e-name" value="${esc(e.name)}"></div>
      <div><label class="label">Tipo</label><select class="input" id="e-type">${['Casamento', 'Festa', 'Formatura', 'Aniversario', 'Corporativo', 'Outro'].map(o => `<option ${e.type === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div><label class="label">Status</label><select class="input" id="e-status">${['Planejamento', 'Confirmado', 'Realizado', 'Cancelado'].map(o => `<option ${e.status === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div><label class="label">Data</label><input class="input" type="date" id="e-date" value="${e.date || ''}"></div>
      <div><label class="label">Hora</label><input class="input" type="time" id="e-time" value="${e.time || ''}"></div>
      <div><label class="label">Local</label><input class="input" id="e-venue" value="${esc(e.venue || '')}"></div>
      <div><label class="label">Endereco</label><input class="input" id="e-address" value="${esc(e.address || '')}"></div>
      <div><label class="label">De quem e o evento?</label><select class="input" id="e-owner">${['Meu', 'Cliente'].map(o => `<option ${e.owner === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
      <div><label class="label">Orcamento total (R$)</label><input class="input" type="number" step="0.01" id="e-budget" value="${e.budget || 0}"></div>
      <div><label class="label">Nome do cliente ${isCli ? '' : '(se for de cliente)'}</label><input class="input" id="e-client" value="${esc(e.clientName || '')}"></div>
      <div><label class="label">Contato do cliente</label><input class="input" id="e-contact" value="${esc(e.clientContact || '')}"></div>
      <div class="md:col-span-2"><label class="label">Observacoes</label><textarea class="input" id="e-notes" rows="2">${esc(e.notes || '')}</textarea></div>
      <div class="md:col-span-2 flex justify-end"><button class="btn btn-primary" id="e-save">Salvar informacoes</button></div>
    </div>`;
  }

  function subEvVendors(e) {
    const rows = (e.vendors || []).map(v => {
      const contratado = Number(v.agreed) || Number(v.quoted) || 0;
      const rest = Math.max(0, contratado - (Number(v.paid) || 0));
      const late = rest > 0 && v.dueDate && v.dueDate < new Date().toISOString().slice(0, 10);
      return `<tr class="${late ? 'bg-bad/5' : ''}">
        <td><b>${esc(v.name)}</b>${v.contact ? `<div class="text-xs text-muted">${esc(v.contact)}</div>` : ''}</td>
        <td><span class="chip">${esc(v.category || '-')}</span></td>
        <td>${brl(v.quoted)}</td><td>${brl(contratado)}</td>
        <td class="text-good">${brl(v.paid)}</td>
        <td class="${rest > 0 ? 'text-warn' : 'text-good'}">${brl(rest)}</td>
        <td>${dbr(v.dueDate)}${late ? ' <span class="badge bg-bad/20 text-bad">atrasado</span>' : ''}</td>
        <td class="text-right whitespace-nowrap"><button class="chip" data-vpay="${v.id}">💰</button> <button class="chip" data-vedit="${v.id}">✏️</button> <button class="chip" data-vdel="${v.id}">🗑️</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" class="text-muted text-center py-4">Nenhum fornecedor</td></tr>';
    return `<div class="card overflow-hidden">
      <div class="flex justify-between items-center p-4"><h3 class="font-semibold">Fornecedores e orcamento</h3><button class="btn btn-primary" id="v-add">+ Fornecedor</button></div>
      <table><thead><tr><th>Fornecedor</th><th>Categoria</th><th>Orcado</th><th>Fechado</th><th>Pago</th><th>A pagar</th><th>Vencimento</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="text-xs text-muted p-4">💰 = registrar pagamento (com opcao de lancar no Fluxo de Caixa do Radar)</p>
    </div>`;
  }

  function subEvGuests(e, ce) {
    const col = { 'Confirmado': 'bg-good/20 text-good', 'Recusado': 'bg-bad/20 text-bad', 'Pendente': 'bg-panel2 text-muted' };
    const rows = (e.guests || []).map(g => `<tr>
      <td><b>${esc(g.name)}</b>${g.contact ? `<div class="text-xs text-muted">${esc(g.contact)}</div>` : ''}</td>
      <td><span class="chip">${esc(g.group || '-')}</span></td>
      <td>${Number(g.companions) || 0}</td>
      <td>${1 + (Number(g.companions) || 0)}</td>
      <td><button class="badge ${col[g.status] || col.Pendente}" data-gtog="${g.id}">${esc(g.status || 'Pendente')}</button></td>
      <td class="text-right whitespace-nowrap"><button class="chip" data-gedit="${g.id}">✏️</button> <button class="chip" data-gdel="${g.id}">🗑️</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="text-muted text-center py-4">Nenhum convidado</td></tr>';
    return `<div class="card overflow-hidden">
      <div class="flex justify-between items-center p-4"><h3 class="font-semibold">Convidados · ${ce.confirmedPeople} pessoas confirmadas de ${ce.invitedPeople}</h3><button class="btn btn-primary" id="g-add">+ Convidado</button></div>
      <table><thead><tr><th>Nome</th><th>Grupo</th><th>Acompanhantes</th><th>Pessoas</th><th>Status (clique)</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  function subEvCheck(e) {
    const today = new Date().toISOString().slice(0, 10);
    const col = { 'Pendente': 'bg-panel2 text-muted', 'Em andamento': 'bg-warn/20 text-warn', 'Concluido': 'bg-good/20 text-good' };
    const rows = (e.checklist || []).map(i => {
      const late = i.status !== 'Concluido' && i.dueDate && i.dueDate < today;
      return `<tr class="${late ? 'bg-bad/5' : ''}"><td>${esc(i.text)}</td>
        <td>${dbr(i.dueDate)}${late ? ' <span class="badge bg-bad/20 text-bad">atrasada</span>' : ''}</td>
        <td><button class="badge ${col[i.status] || col.Pendente}" data-ctog="${i.id}">${esc(i.status || 'Pendente')}</button></td>
        <td class="text-right"><button class="chip" data-cdel="${i.id}">🗑️</button></td></tr>`;
    }).join('') || '<tr><td colspan="4" class="text-muted text-center py-4">Nenhuma tarefa</td></tr>';
    return `<div class="card overflow-hidden">
      <div class="flex justify-between items-center p-4"><h3 class="font-semibold">Checklist</h3><button class="btn btn-primary" id="c-add">+ Tarefa</button></div>
      <table><thead><tr><th>Tarefa</th><th>Prazo</th><th>Status (clique)</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  function subEvFee(e, ce) {
    const f = e.fee || { total: 0, installments: 1, receipts: [] };
    const rows = (f.receipts || []).slice().reverse().map(r => `<tr><td>${dbr(r.date)}</td><td class="text-good">${brl(r.amount)}</td><td>${esc(r.note || '')}</td><td class="text-right"><button class="chip" data-rdel="${r.id}">🗑️</button></td></tr>`).join('') || '<tr><td colspan="4" class="text-muted text-center py-4">Nenhum recebimento</td></tr>';
    return `<div class="card p-5">
      <div class="flex justify-between items-center mb-3"><h3 class="font-semibold">Honorarios do cliente${e.clientName ? ' · ' + esc(e.clientName) : ''}</h3><button class="btn btn-primary" id="r-add">+ Recebimento</button></div>
      <div class="grid md:grid-cols-2 gap-4 mb-4">
        <div><label class="label">Valor combinado (R$)</label><input class="input" type="number" step="0.01" id="f-total" value="${f.total || 0}"></div>
        <div><label class="label">Numero de parcelas</label><input class="input" type="number" min="1" id="f-inst" value="${f.installments || 1}"></div>
      </div>
      <div class="flex justify-end mb-4"><button class="btn btn-ghost" id="f-save">Salvar honorarios</button></div>
      <div class="grid grid-cols-3 gap-4 mb-4">
        ${statCard('Combinado', brl(ce.feeTotal))}
        ${statCard('Recebido', brl(ce.feeReceived), null, 'text-good')}
        ${statCard('A receber', brl(ce.feeToReceive), null, 'text-warn')}
      </div>
      <table><thead><tr><th>Data</th><th>Valor</th><th>Obs</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }

  function bindEvSub(ce) {
    const e = state.ev;
    // Info
    if ($('#e-save')) $('#e-save').addEventListener('click', () => {
      e.name = $('#e-name').value || e.name; e.type = $('#e-type').value; e.status = $('#e-status').value;
      e.date = $('#e-date').value; e.time = $('#e-time').value; e.venue = $('#e-venue').value; e.address = $('#e-address').value;
      e.owner = $('#e-owner').value; e.budget = Number($('#e-budget').value) || 0;
      e.clientName = $('#e-client').value; e.clientContact = $('#e-contact').value; e.notes = $('#e-notes').value;
      toast('Salvo', 'ok'); saveEv();
    });
    // Fornecedores
    const vFields = (v) => [
      { name: 'name', label: 'Fornecedor', required: true, col: 'full', value: v && v.name },
      { name: 'category', label: 'Categoria', type: 'select', value: v && v.category, options: EV_CATS.map(o => ({ value: o, label: o })) },
      { name: 'contact', label: 'Contato', value: v && v.contact },
      { name: 'quoted', label: 'Valor orcado (R$)', type: 'number', step: '0.01', value: v && v.quoted },
      { name: 'agreed', label: 'Valor fechado (R$)', type: 'number', step: '0.01', value: v && v.agreed },
      { name: 'paid', label: 'Ja pago (R$)', type: 'number', step: '0.01', value: v && v.paid },
      { name: 'dueDate', label: 'Vencimento do pagamento', type: 'date', value: v && v.dueDate },
      { name: 'status', label: 'Status', type: 'select', value: v && v.status, options: ['Orcando', 'Fechado', 'Pago'].map(o => ({ value: o, label: o })) },
      { name: 'notes', label: 'Observacoes', col: 'full', value: v && v.notes }
    ];
    if ($('#v-add')) $('#v-add').addEventListener('click', () => formModal('Novo fornecedor', vFields(), async v => { (e.vendors = e.vendors || []).push(Object.assign({ id: genId() }, v)); closeModal(); saveEv(); }));
    document.querySelectorAll('[data-vedit]').forEach(b => b.addEventListener('click', () => { const v = e.vendors.find(x => x.id === b.dataset.vedit); formModal('Editar fornecedor', vFields(v), async nv => { Object.assign(v, nv); closeModal(); saveEv(); }); }));
    document.querySelectorAll('[data-vdel]').forEach(b => b.addEventListener('click', () => { e.vendors = e.vendors.filter(x => x.id !== b.dataset.vdel); saveEv(); }));
    document.querySelectorAll('[data-vpay]').forEach(b => b.addEventListener('click', () => {
      const v = e.vendors.find(x => x.id === b.dataset.vpay);
      const rest = Math.max(0, (Number(v.agreed) || Number(v.quoted) || 0) - (Number(v.paid) || 0));
      formModal('Registrar pagamento · ' + v.name, [
        { name: 'amount', label: 'Valor pago (R$)', type: 'number', step: '0.01', required: true, value: rest || '' },
        { name: 'date', label: 'Data', type: 'date', value: new Date().toISOString().slice(0, 10) },
        { name: 'affectCashflow', label: 'Lancar no Fluxo de Caixa?', type: 'select', options: [{ value: '', label: 'Nao' }, { value: '1', label: 'Sim, como despesa' }] }
      ], async val => { await api('POST', '/events/' + e.id + '/pay', { vendorId: v.id, amount: val.amount, date: val.date, affectCashflow: !!val.affectCashflow }); closeModal(); toast('Pagamento registrado', 'ok'); go('eventos'); });
    }));
    // Convidados
    const gStatus = { 'Pendente': 'Confirmado', 'Confirmado': 'Recusado', 'Recusado': 'Pendente' };
    const gFields = (g) => [
      { name: 'name', label: 'Nome', required: true, col: 'full', value: g && g.name },
      { name: 'group', label: 'Grupo', type: 'select', value: g && g.group, options: ['Familia', 'Amigos', 'Trabalho', 'Outros'].map(o => ({ value: o, label: o })) },
      { name: 'companions', label: 'Acompanhantes', type: 'number', min: 0, value: (g && g.companions) || 0 },
      { name: 'contact', label: 'Contato', value: g && g.contact },
      { name: 'status', label: 'Status', type: 'select', value: g && g.status, options: ['Pendente', 'Confirmado', 'Recusado'].map(o => ({ value: o, label: o })) }
    ];
    if ($('#g-add')) $('#g-add').addEventListener('click', () => formModal('Novo convidado', gFields(), async v => { (e.guests = e.guests || []).push(Object.assign({ id: genId() }, v, { companions: Number(v.companions) || 0 })); closeModal(); saveEv(); }));
    document.querySelectorAll('[data-gedit]').forEach(b => b.addEventListener('click', () => { const g = e.guests.find(x => x.id === b.dataset.gedit); formModal('Editar convidado', gFields(g), async v => { Object.assign(g, v, { companions: Number(v.companions) || 0 }); closeModal(); saveEv(); }); }));
    document.querySelectorAll('[data-gdel]').forEach(b => b.addEventListener('click', () => { e.guests = e.guests.filter(x => x.id !== b.dataset.gdel); saveEv(); }));
    document.querySelectorAll('[data-gtog]').forEach(b => b.addEventListener('click', () => { const g = e.guests.find(x => x.id === b.dataset.gtog); g.status = gStatus[g.status || 'Pendente']; saveEv(); }));
    // Checklist
    const cStatus = { 'Pendente': 'Em andamento', 'Em andamento': 'Concluido', 'Concluido': 'Pendente' };
    if ($('#c-add')) $('#c-add').addEventListener('click', () => formModal('Nova tarefa', [
      { name: 'text', label: 'Tarefa', required: true, col: 'full', placeholder: 'Ex: Reservar o local' },
      { name: 'dueDate', label: 'Prazo', type: 'date' }
    ], async v => { (e.checklist = e.checklist || []).push({ id: genId(), text: v.text, dueDate: v.dueDate, status: 'Pendente' }); closeModal(); saveEv(); }));
    document.querySelectorAll('[data-ctog]').forEach(b => b.addEventListener('click', () => { const i = e.checklist.find(x => x.id === b.dataset.ctog); i.status = cStatus[i.status || 'Pendente']; saveEv(); }));
    document.querySelectorAll('[data-cdel]').forEach(b => b.addEventListener('click', () => { e.checklist = e.checklist.filter(x => x.id !== b.dataset.cdel); saveEv(); }));
    // Honorarios
    if ($('#f-save')) $('#f-save').addEventListener('click', () => {
      if (!e.fee) e.fee = { receipts: [] };
      e.fee.total = Number($('#f-total').value) || 0; e.fee.installments = Number($('#f-inst').value) || 1;
      toast('Salvo', 'ok'); saveEv();
    });
    if ($('#r-add')) $('#r-add').addEventListener('click', () => formModal('Registrar recebimento', [
      { name: 'amount', label: 'Valor recebido (R$)', type: 'number', step: '0.01', required: true },
      { name: 'date', label: 'Data', type: 'date', value: new Date().toISOString().slice(0, 10) },
      { name: 'note', label: 'Observacao' },
      { name: 'affectCashflow', label: 'Lancar no Fluxo de Caixa?', type: 'select', options: [{ value: '', label: 'Nao' }, { value: '1', label: 'Sim, como receita' }] }
    ], async v => { await api('POST', '/events/' + e.id + '/receive', { amount: v.amount, date: v.date, note: v.note, affectCashflow: !!v.affectCashflow }); closeModal(); toast('Recebimento registrado', 'ok'); go('eventos'); }));
    document.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', () => { e.fee.receipts = e.fee.receipts.filter(x => x.id !== b.dataset.rdel); saveEv(); }));
  }


  // ---------------- Boot ----------------
  if (state.token) { state.app = 'hub'; renderHub(); } else { renderAuth(); }
})();
