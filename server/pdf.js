/**
 * Geração de PDF via PDFKit (biblioteca Node pura, sem Chromium).
 * Expõe duas funções:
 *   buildEventReportPdf(e, c)      → relatório interno completo
 *   buildClientShoppingPdf(e, c)   → lista de compras para o cliente
 */

const PDFDocument = require('pdfkit');

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dbr(s) {
  return s ? s.split('-').reverse().join('/') : '—';
}

function hexToRgb(hex) {
  const h = (hex || '#B9502C').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Retorna um Buffer com o PDF gerado.
 * @param {Function} buildFn - função (doc) => void que desenha o documento
 */
function buildPdf(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      buildFn(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ── primitivos de layout ──────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const COL_W  = PAGE_W - MARGIN * 2;

/** Cabeçalho colorido com nome do evento */
function drawCover(doc, e, subtitle, themeRgb) {
  const [r, g, b] = themeRgb;
  doc.rect(0, 0, PAGE_W, 110).fill(`rgb(${r},${g},${b})`);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22)
     .text(e.name || 'Evento', MARGIN, 22, { width: COL_W });
  if (subtitle) {
    doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.88)')
       .text(subtitle, MARGIN, doc.y + 2, { width: COL_W });
  }
  const meta = [e.type, e.date ? dbr(e.date) + (e.time ? ' às ' + e.time : '') : '', e.venue]
    .filter(Boolean).join('  ·  ');
  if (meta) {
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.80)')
       .text(meta, MARGIN, doc.y + 3, { width: COL_W });
  }
  if (e.clientName) {
    doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.80)')
       .text('Cliente: ' + e.clientName + (e.clientContact ? '  ·  ' + e.clientContact : ''), MARGIN, doc.y + 2, { width: COL_W });
  }
  doc.moveDown(0.3);
  // badge de status
  const badgeY = 88;
  const badgeText = e.status || 'Planejamento';
  const bW = doc.widthOfString(badgeText) + 18;
  doc.roundedRect(MARGIN, badgeY, bW, 16, 8).fill('rgba(255,255,255,0.22)');
  doc.fillColor('#ffffff').font('Helvetica').fontSize(8).text(badgeText, MARGIN + 9, badgeY + 4);
}

/** Linha horizontal separadora */
function hr(doc, y, color) {
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(color || '#E9DECB').lineWidth(0.5).stroke();
}

/** Título de seção */
function sectionTitle(doc, title, themeRgb, y) {
  const [r, g, b] = themeRgb;
  const ty = y || doc.y;
  doc.rect(MARGIN, ty, COL_W, 18).fill(`rgb(${r},${g},${b})`);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
     .text(title.toUpperCase(), MARGIN + 8, ty + 5, { width: COL_W - 16, characterSpacing: 0.5 });
  doc.y = ty + 22;
}

/** KPI card inline */
function kpiRow(doc, items, themeRgb) {
  const [r, g, b] = themeRgb;
  const w = Math.floor(COL_W / items.length) - 4;
  let x = MARGIN;
  const rowY = doc.y;
  items.forEach(({ label, value, color }) => {
    doc.rect(x, rowY, w, 38).fill('#FAF7F2').stroke('#E9DECB');
    doc.fillColor('#8B7355').font('Helvetica').fontSize(7)
       .text(label.toUpperCase(), x + 6, rowY + 6, { width: w - 12 });
    doc.fillColor(color || '#2C2416').font('Helvetica-Bold').fontSize(13)
       .text(String(value), x + 6, rowY + 16, { width: w - 12 });
    x += w + 4;
  });
  doc.y = rowY + 46;
}

/** Tabela genérica */
function table(doc, headers, rows, colWidths, themeRgb) {
  const [r, g, b] = themeRgb;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const startX = MARGIN + (COL_W - totalW) / 2;

  // cabeçalho
  let x = startX;
  const hY = doc.y;
  doc.rect(startX, hY, totalW, 16).fill('#FAF7F2');
  headers.forEach((h, i) => {
    doc.fillColor('#8B7355').font('Helvetica-Bold').fontSize(7)
       .text(h.toUpperCase(), x + 4, hY + 5, { width: colWidths[i] - 8, ellipsis: true });
    x += colWidths[i];
  });
  doc.y = hY + 18;

  rows.forEach((row, ri) => {
    // quebra de página automática
    if (doc.y + 18 > PAGE_H - 40) {
      doc.addPage();
      doc.y = MARGIN;
    }
    const rowY = doc.y;
    const bg = ri % 2 === 0 ? '#FFFFFF' : '#FAF7F2';
    doc.rect(startX, rowY, totalW, 16).fill(bg);
    x = startX;
    row.forEach((cell, i) => {
      const txt = cell == null ? '—' : String(cell);
      doc.fillColor('#2C2416').font('Helvetica').fontSize(8)
         .text(txt, x + 4, rowY + 4, { width: colWidths[i] - 8, ellipsis: true });
      x += colWidths[i];
    });
    doc.y = rowY + 18;
  });

  hr(doc, doc.y, '#E9DECB');
  doc.moveDown(0.5);
}

// ── Relatório Interno ─────────────────────────────────────────────────────────

async function buildEventReportPdf(e, c) {
  return buildPdf(doc => {
    const theme = e.themeColor || '#B9502C';
    const themeRgb = hexToRgb(theme);
    const fmt2 = n => fmt(n);

    // Capa
    drawCover(doc, e, 'Relatório do Evento', themeRgb);
    doc.y = 120;

    // KPIs financeiros
    sectionTitle(doc, 'Resumo Financeiro', themeRgb);
    kpiRow(doc, [
      { label: 'Orçamento',   value: fmt2(c.budget) },
      { label: 'Contratado',  value: fmt2(c.contracted) },
      { label: 'Pago',        value: fmt2(c.paid),        color: '#2D7A4F' },
      { label: 'A pagar',     value: fmt2(c.toPay),       color: c.toPay > 0 ? '#C0392B' : '#2D7A4F' },
    ], themeRgb);

    // KPIs de convidados
    sectionTitle(doc, 'Convidados', themeRgb);
    kpiRow(doc, [
      { label: 'Total',        value: c.guestsTotal },
      { label: 'Confirmados',  value: c.confirmedPeople, color: '#2D7A4F' },
      { label: 'Pendentes',    value: c.pendingGuests },
      { label: 'Recusados',    value: c.refusedGuests,   color: '#C0392B' },
    ], themeRgb);

    // KPIs checklist + dias
    const kpiExtra = [
      { label: 'Checklist',       value: c.checkPercent + '%' },
      { label: 'Concluídas',      value: c.checkDone + '/' + c.checklistTotal },
    ];
    if (c.daysLeft != null) kpiExtra.push({ label: 'Dias restantes', value: c.daysLeft, color: c.daysLeft <= 7 ? '#C0392B' : '#2C2416' });
    if (c.adults > 0)       kpiExtra.push({ label: 'Adultos',        value: c.adults });
    if (c.kidsUnder10 > 0)  kpiExtra.push({ label: 'Crianças',       value: c.kidsUnder10 });
    sectionTitle(doc, 'Checklist & Público', themeRgb);
    kpiRow(doc, kpiExtra.slice(0, 4), themeRgb);

    // Fornecedores
    const vendors = e.vendors || [];
    if (vendors.length) {
      sectionTitle(doc, 'Fornecedores', themeRgb);
      table(doc,
        ['Fornecedor', 'Categoria', 'Orçado', 'Fechado', 'Pago', 'A pagar', 'Vencimento'],
        vendors.map(v => {
          const agreed = Number(v.agreed) || Number(v.quoted) || 0;
          return [v.name, v.category || '—', fmt2(v.quoted), fmt2(agreed), fmt2(v.paid), fmt2(Math.max(0, agreed - (Number(v.paid)||0))), v.dueDate ? dbr(v.dueDate) : '—'];
        }),
        [110, 70, 60, 60, 55, 60, 60], themeRgb
      );
    }

    // Convidados
    const guests = e.guests || [];
    if (guests.length) {
      sectionTitle(doc, `Lista de Convidados (${c.guestsTotal} total)`, themeRgb);
      table(doc,
        ['Nome', 'Grupo', 'Contato', 'Status', 'Idade'],
        guests.map(g => [g.name, g.group || '—', g.contact || '—', g.status || 'Pendente', g.age != null && g.age !== '' ? g.age + ' anos' : '—']),
        [150, 80, 110, 70, 55], themeRgb
      );
    }

    // Checklist
    const checklist = e.checklist || [];
    if (checklist.length) {
      sectionTitle(doc, `Checklist (${c.checkPercent}% concluído)`, themeRgb);
      table(doc,
        ['Tarefa', 'Prazo', 'Status'],
        checklist.map(i => [i.text, i.dueDate ? dbr(i.dueDate) : '—', i.status || 'Pendente']),
        [280, 80, 105], themeRgb
      );
    }

    // Honorários
    if (e.owner === 'Cliente' && c.feeTotal > 0) {
      sectionTitle(doc, 'Honorários', themeRgb);
      kpiRow(doc, [
        { label: 'Total combinado', value: fmt2(c.feeTotal) },
        { label: 'Recebido',        value: fmt2(c.feeReceived),   color: '#2D7A4F' },
        { label: 'A receber',       value: fmt2(c.feeToReceive),  color: c.feeToReceive > 0 ? '#C0392B' : '#2D7A4F' },
      ], themeRgb);
    }

    // Observações
    if (e.notes) {
      sectionTitle(doc, 'Observações', themeRgb);
      doc.rect(MARGIN, doc.y, COL_W, 6).fill('#FAF7F2');
      doc.fillColor('#5C4A2A').font('Helvetica').fontSize(9)
         .text(e.notes, MARGIN + 10, doc.y + 8, { width: COL_W - 20 });
      doc.moveDown(1);
    }

    // Rodapé
    const footY = PAGE_H - 30;
    hr(doc, footY - 4, '#E9DECB');
    doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8)
       .text(`Relatório gerado em ${new Date().toLocaleString('pt-BR')}  ·  Radar Financeiro`, MARGIN, footY, { width: COL_W, align: 'center' });
  });
}

// ── Lista de Compras do Cliente ───────────────────────────────────────────────

async function buildClientShoppingPdf(e, c) {
  return buildPdf(doc => {
    const theme = e.themeColor || '#B9502C';
    const themeRgb = hexToRgb(theme);
    const eventDate = e.date ? dbr(e.date) + (e.time ? ' às ' + e.time : '') : 'Data a confirmar';
    const clientName = e.clientName || 'Cliente';

    // Capa
    drawCover(doc, e, 'Lista de Compras para o Evento', themeRgb);
    doc.y = 120;

    // Saudação
    const [r, g, b] = themeRgb;
    doc.rect(MARGIN, doc.y, COL_W, 36).fill('#FAF7F2').stroke('#E9DECB');
    doc.fillColor('#5C4A2A').font('Helvetica').fontSize(9)
       .text(`Olá, ${clientName}! Este documento reúne tudo que precisa ser providenciado para o seu evento.`, MARGIN + 10, doc.y + 6, { width: COL_W - 20 })
       .text('Use a coluna  ✓  para marcar o que já foi adquirido.', MARGIN + 10, doc.y + 2, { width: COL_W - 20 });
    doc.y += 46;

    // KPIs resumo
    sectionTitle(doc, 'Resumo do Evento', themeRgb);
    const kpiItems = [
      { label: 'Data',        value: eventDate },
      { label: 'Convidados',  value: c.guestsTotal },
      { label: 'Confirmados', value: c.confirmedPeople, color: '#2D7A4F' },
    ];
    if (c.adults > 0)      kpiItems.push({ label: 'Adultos',   value: c.adults });
    if (c.kidsUnder10 > 0) kpiItems.push({ label: 'Crianças',  value: c.kidsUnder10 });
    kpiRow(doc, kpiItems.slice(0, 4), themeRgb);

    // Função para seção de itens com quantidade
    const itemSection = (title, items, unitFallback) => {
      if (!items || !items.length) return;
      sectionTitle(doc, title, themeRgb);
      table(doc,
        ['Item', 'Quantidade', 'Unidade', 'Observações', '✓'],
        items.map(i => [
          i.name || i.text || '',
          i.qty != null ? (Number(i.qty) % 1 === 0 ? Number(i.qty) : Number(i.qty).toFixed(2)) : '—',
          i.unit || unitFallback || 'unidade',
          i.notes || '',
          '',
        ]),
        [160, 65, 65, 130, 30], themeRgb
      );
    };

    // Alimentação
    const foodItems = (e.planFood || []).filter(i => (Number(i.qty) || 0) > 0);
    itemSection('Alimentação', foodItems, 'unidade');

    // Bebidas
    const drinkItems = (e.planDrinks || []).filter(i => (Number(i.qty) || 0) > 0);
    itemSection('Bebidas', drinkItems, 'unidade');

    // Decoração
    const decorItems = (e.planDecor || []).filter(i => (Number(i.qty) || 0) > 0);
    itemSection('Decoração', decorItems, 'unidade');

    // Materiais
    const matItems = (e.planMaterials || []).filter(i => (Number(i.qty) || 0) > 0);
    itemSection('Materiais e Suprimentos', matItems, 'unidade');

    // Equipe
    const teamItems = (e.planTeam || []).filter(i => (Number(i.qty) || 0) > 0);
    itemSection('Equipe Necessária', teamItems, 'pessoa(s)');

    // Checklist pendente
    const pendingCheck = (e.checklist || []).filter(i => i.status !== 'Concluido');
    if (pendingCheck.length) {
      sectionTitle(doc, 'Pendentes no Checklist', themeRgb);
      table(doc,
        ['Tarefa', 'Prazo', 'Prioridade', '✓'],
        pendingCheck.map(i => [
          i.text || '',
          i.dueDate ? dbr(i.dueDate) : '—',
          i.priority || '—',
          '',
        ]),
        [230, 80, 100, 30], themeRgb
      );
    }

    // Cronograma
    const schedItems = e.schedule || [];
    if (schedItems.length) {
      sectionTitle(doc, 'Cronograma do Dia', themeRgb);
      table(doc,
        ['#', 'Etapa', 'Hora / Categoria'],
        schedItems.map((i, idx) => [idx + 1, i.text || i.name || '', i.time || i.category || '']),
        [30, 260, 175], themeRgb
      );
    }

    // Aviso se não há itens
    const totalItems = foodItems.length + drinkItems.length + decorItems.length + matItems.length + teamItems.length + pendingCheck.length + schedItems.length;
    if (totalItems === 0) {
      doc.rect(MARGIN, doc.y, COL_W, 50).fill('#FAF7F2').stroke('#E9DECB');
      doc.fillColor('#aaaaaa').font('Helvetica').fontSize(10)
         .text('Nenhum item de planejamento encontrado.', MARGIN + 10, doc.y + 10, { width: COL_W - 20, align: 'center' })
         .text('Aplique um Perfil Inteligente ao evento para gerar a lista automaticamente.', MARGIN + 10, doc.y + 2, { width: COL_W - 20, align: 'center' });
      doc.y += 60;
    }

    // Rodapé
    const footY = PAGE_H - 30;
    hr(doc, footY - 4, '#E9DECB');
    doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8)
       .text(`Lista gerada em ${new Date().toLocaleString('pt-BR')}  ·  ${e.name}  ·  Radar Financeiro`, MARGIN, footY, { width: COL_W, align: 'center' });
  });
}

module.exports = { buildEventReportPdf, buildClientShoppingPdf };
