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

// ── constantes de layout ──────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const COL_W  = PAGE_W - MARGIN * 2;
const COVER_H = 160; // altura total do cabeçalho

// ── cabeçalho com identidade visual JT ───────────────────────────────────────

/**
 * Desenha o cabeçalho de identidade visual Jacqueline Tellechea.
 * Retorna a posição Y onde o conteúdo deve começar.
 */
function drawCover(doc, e, subtitle, themeRgb) {
  const [r, g, b] = themeRgb;

  // ── fundo bege creme ──
  doc.rect(0, 0, PAGE_W, COVER_H).fill('#F5EFE6');

  // ── faixa de cor do evento no topo ──
  doc.rect(0, 0, PAGE_W, 5).fill(`rgb(${r},${g},${b})`);

  // ── círculo decorativo (canto direito, bem sutil) ──
  doc.save();
  doc.circle(PAGE_W + 10, -10, 90)
     .fill(`rgb(${r},${g},${b})`);
  doc.restore();
  // sobreposição branca para deixar o círculo transparente
  doc.save();
  doc.circle(PAGE_W + 10, -10, 90)
     .fillOpacity(0.93).fill('#F5EFE6').fillOpacity(1);
  doc.restore();

  // ── Monograma JT: arco (topo semicircular + lados retos) ──
  // Desenhado manualmente com bezierCurveTo para simular o arco da identidade
  const mX = MARGIN;
  const mY = 16;
  const mW = 42;
  const mH = 52;
  const mR = mW / 2; // raio do semicírculo no topo

  doc.save();
  doc.moveTo(mX, mY + mR)                                          // lado esquerdo, início do arco
     .bezierCurveTo(mX, mY, mX + mW / 2, mY, mX + mW / 2, mY)    // arco esquerdo
     .bezierCurveTo(mX + mW, mY, mX + mW, mY + mR, mX + mW, mY + mR) // arco direito
     .lineTo(mX + mW, mY + mH)                                     // lado direito
     .lineTo(mX, mY + mH)                                          // base
     .closePath()
     .strokeColor('#3D3530').lineWidth(1.3).stroke();
  doc.restore();

  // Letras JT dentro do arco
  doc.fillColor('#3D3530').font('Helvetica').fontSize(17)
     .text('JT', mX, mY + 17, { width: mW, align: 'center', characterSpacing: 3, lineBreak: false });

  // ── Nome e tagline ──
  const textX = MARGIN + mW + 16;
  const nameY  = 22;
  doc.fillColor('#2C2420').font('Helvetica-Bold').fontSize(16)
     .text('Jacqueline Tellechea', textX, nameY, { width: COL_W - mW - 16, lineBreak: false });
  doc.fillColor('#8C7B6E').font('Helvetica').fontSize(7.5)
     .text('ASSESSORIA DE EVENTOS', textX, nameY + 22, { width: COL_W - mW - 16, characterSpacing: 2.5, lineBreak: false });

  // ── linha separadora ──
  const sepY = mY + mH + 10;
  doc.moveTo(MARGIN, sepY).lineTo(PAGE_W - MARGIN, sepY)
     .strokeColor('#D8CCBC').lineWidth(0.7).stroke();

  // ── nome do evento ──
  const evY = sepY + 10;
  doc.fillColor('#2C2420').font('Helvetica-Bold').fontSize(17)
     .text(e.name || 'Evento', MARGIN, evY, { width: COL_W, lineBreak: false });

  // subtítulo (ex: "Relatório do Evento")
  if (subtitle) {
    doc.fillColor(`rgb(${r},${g},${b})`).font('Helvetica').fontSize(8.5)
       .text(subtitle, MARGIN, evY + 22, { width: COL_W, lineBreak: false });
  }

  // meta: tipo · data · local
  const meta = [e.type, e.date ? dbr(e.date) + (e.time ? ' às ' + e.time : '') : '', e.venue]
    .filter(Boolean).join('  ·  ');
  if (meta) {
    doc.fillColor('#8C7B6E').font('Helvetica').fontSize(8.5)
       .text(meta, MARGIN, evY + (subtitle ? 36 : 22), { width: COL_W - 80, lineBreak: false });
  }

  // cliente
  if (e.clientName) {
    doc.fillColor('#8C7B6E').font('Helvetica').fontSize(8.5)
       .text('Cliente: ' + e.clientName + (e.clientContact ? '  ·  ' + e.clientContact : ''),
             MARGIN, evY + (subtitle ? 50 : 36), { width: COL_W - 80, lineBreak: false });
  }

  // badge de status (canto direito)
  const badgeText = e.status || 'Planejamento';
  const bW = Math.max(doc.widthOfString(badgeText) + 18, 70);
  const bX = PAGE_W - MARGIN - bW;
  const bY = evY + 4;
  doc.roundedRect(bX, bY, bW, 16, 8).fill(`rgb(${r},${g},${b})`);
  doc.fillColor('#ffffff').font('Helvetica').fontSize(7.5)
     .text(badgeText, bX, bY + 4.5, { width: bW, align: 'center', lineBreak: false });

  // posiciona o cursor logo após o cabeçalho
  doc.y = COVER_H + 8;
}

// ── primitivos de layout ──────────────────────────────────────────────────────

function hr(doc, y, color) {
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
     .strokeColor(color || '#E9DECB').lineWidth(0.5).stroke();
}

function sectionTitle(doc, title, themeRgb) {
  const [r, g, b] = themeRgb;
  if (doc.y + 24 > PAGE_H - 50) { doc.addPage(); doc.y = MARGIN; }
  const ty = doc.y;
  doc.rect(MARGIN, ty, COL_W, 18).fill(`rgb(${r},${g},${b})`);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
     .text(title.toUpperCase(), MARGIN + 8, ty + 5, { width: COL_W - 16, characterSpacing: 0.5, lineBreak: false });
  doc.y = ty + 24;
}

function kpiRow(doc, items, themeRgb) {
  if (doc.y + 50 > PAGE_H - 50) { doc.addPage(); doc.y = MARGIN; }
  const w = Math.floor(COL_W / items.length) - 3;
  let x = MARGIN;
  const rowY = doc.y;
  items.forEach(({ label, value, color }) => {
    doc.rect(x, rowY, w, 40).fill('#FAF7F2');
    doc.moveTo(x, rowY).lineTo(x + w, rowY).strokeColor('#E2D5C0').lineWidth(0.5).stroke();
    doc.moveTo(x, rowY + 40).lineTo(x + w, rowY + 40).strokeColor('#E2D5C0').lineWidth(0.5).stroke();
    doc.fillColor('#8B7355').font('Helvetica').fontSize(7)
       .text(label.toUpperCase(), x + 6, rowY + 7, { width: w - 12, lineBreak: false });
    doc.fillColor(color || '#2C2416').font('Helvetica-Bold').fontSize(13)
       .text(String(value != null ? value : '—'), x + 6, rowY + 18, { width: w - 12, lineBreak: false });
    x += w + 3;
  });
  doc.y = rowY + 48;
}

function table(doc, headers, rows, colWidths, themeRgb) {
  const [r, g, b] = themeRgb;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const startX = MARGIN;

  if (doc.y + 20 > PAGE_H - 50) { doc.addPage(); doc.y = MARGIN; }

  // cabeçalho da tabela
  let x = startX;
  const hY = doc.y;
  doc.rect(startX, hY, totalW, 16).fill('#EDE4D6');
  headers.forEach((h, i) => {
    doc.fillColor('#5C4030').font('Helvetica-Bold').fontSize(7)
       .text(h.toUpperCase(), x + 4, hY + 5, { width: colWidths[i] - 8, ellipsis: true, lineBreak: false });
    x += colWidths[i];
  });
  doc.y = hY + 18;

  rows.forEach((row, ri) => {
    if (doc.y + 18 > PAGE_H - 50) {
      doc.addPage();
      doc.y = MARGIN;
      // repetir cabeçalho
      x = startX;
      const hY2 = doc.y;
      doc.rect(startX, hY2, totalW, 16).fill('#EDE4D6');
      headers.forEach((h, i) => {
        doc.fillColor('#5C4030').font('Helvetica-Bold').fontSize(7)
           .text(h.toUpperCase(), x + 4, hY2 + 5, { width: colWidths[i] - 8, ellipsis: true, lineBreak: false });
        x += colWidths[i];
      });
      doc.y = hY2 + 18;
    }
    const rowY = doc.y;
    const bg = ri % 2 === 0 ? '#FFFFFF' : '#FAF7F2';
    doc.rect(startX, rowY, totalW, 16).fill(bg);
    x = startX;
    row.forEach((cell, i) => {
      const txt = cell == null ? '—' : String(cell);
      doc.fillColor('#2C2416').font('Helvetica').fontSize(8)
         .text(txt, x + 4, rowY + 4, { width: colWidths[i] - 8, ellipsis: true, lineBreak: false });
      x += colWidths[i];
    });
    doc.y = rowY + 18;
  });

  hr(doc, doc.y, '#E9DECB');
  doc.y += 8;
}

function drawFooter(doc, text) {
  const footY = PAGE_H - 28;
  hr(doc, footY - 6, '#E2D5C0');
  doc.fillColor('#aaaaaa').font('Helvetica').fontSize(7.5)
     .text(text, MARGIN, footY, { width: COL_W, align: 'center', lineBreak: false });
}

// ── Relatório Interno ─────────────────────────────────────────────────────────

async function buildEventReportPdf(e, c) {
  return buildPdf(doc => {
    const theme = e.themeColor || '#B9502C';
    const themeRgb = hexToRgb(theme);

    // Capa
    drawCover(doc, e, 'Relatório do Evento', themeRgb);

    // KPIs financeiros
    sectionTitle(doc, 'Resumo Financeiro', themeRgb);
    kpiRow(doc, [
      { label: 'Orçamento',   value: fmt(c.budget) },
      { label: 'Contratado',  value: fmt(c.contracted) },
      { label: 'Pago',        value: fmt(c.paid),        color: '#2D7A4F' },
      { label: 'A pagar',     value: fmt(c.toPay),       color: (c.toPay || 0) > 0 ? '#C0392B' : '#2D7A4F' },
    ], themeRgb);

    // KPIs de convidados
    sectionTitle(doc, 'Convidados', themeRgb);
    kpiRow(doc, [
      { label: 'Total',        value: c.guestsTotal || c.invitedPeople || 0 },
      { label: 'Confirmados',  value: c.confirmedPeople || 0, color: '#2D7A4F' },
      { label: 'Pendentes',    value: c.pendingGuests || 0 },
      { label: 'Recusados',    value: c.refusedGuests || 0, color: '#C0392B' },
    ], themeRgb);

    // KPIs checklist + dias
    const kpiExtra = [
      { label: 'Checklist',    value: (c.checkPercent || 0) + '%' },
      { label: 'Concluídas',   value: (c.checkDone || 0) + '/' + (c.checklistTotal || 0) },
    ];
    if (c.daysLeft != null) kpiExtra.push({ label: 'Dias restantes', value: c.daysLeft, color: c.daysLeft <= 7 ? '#C0392B' : '#2C2416' });
    if ((c.adults || 0) > 0)      kpiExtra.push({ label: 'Adultos',   value: c.adults });
    if ((c.kidsUnder10 || 0) > 0) kpiExtra.push({ label: 'Crianças',  value: c.kidsUnder10 });
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
          return [v.name, v.category || '—', fmt(v.quoted), fmt(agreed), fmt(v.paid), fmt(Math.max(0, agreed - (Number(v.paid)||0))), v.dueDate ? dbr(v.dueDate) : '—'];
        }),
        [110, 70, 60, 60, 55, 60, 60], themeRgb
      );
    }

    // Convidados
    const guests = e.guests || [];
    if (guests.length) {
      sectionTitle(doc, `Lista de Convidados (${c.guestsTotal || guests.length} total)`, themeRgb);
      table(doc,
        ['Nome', 'Grupo', 'Contato', 'Status', 'Idade'],
        guests.map(g => [g.name, g.group || '—', g.contact || '—', g.status || 'Pendente', g.age != null && g.age !== '' ? g.age + ' anos' : '—']),
        [150, 80, 110, 70, 55], themeRgb
      );
    }

    // Checklist
    const checklist = e.checklist || [];
    if (checklist.length) {
      sectionTitle(doc, `Checklist (${c.checkPercent || 0}% concluído)`, themeRgb);
      table(doc,
        ['Tarefa', 'Prazo', 'Status'],
        checklist.map(i => [i.text, i.dueDate ? dbr(i.dueDate) : '—', i.status || 'Pendente']),
        [280, 80, 105], themeRgb
      );
    }

    // Honorários
    if (e.owner === 'Cliente' && (c.feeTotal || 0) > 0) {
      sectionTitle(doc, 'Honorários', themeRgb);
      kpiRow(doc, [
        { label: 'Total combinado', value: fmt(c.feeTotal) },
        { label: 'Recebido',        value: fmt(c.feeReceived),   color: '#2D7A4F' },
        { label: 'A receber',       value: fmt(c.feeToReceive),  color: (c.feeToReceive || 0) > 0 ? '#C0392B' : '#2D7A4F' },
      ], themeRgb);
    }

    // Observações
    if (e.notes) {
      sectionTitle(doc, 'Observações', themeRgb);
      doc.rect(MARGIN, doc.y, COL_W, 8).fill('#FAF7F2');
      doc.fillColor('#5C4A2A').font('Helvetica').fontSize(9)
         .text(e.notes, MARGIN + 10, doc.y + 10, { width: COL_W - 20 });
      doc.moveDown(1);
    }

    // Rodapé
    drawFooter(doc, `Relatório gerado em ${new Date().toLocaleString('pt-BR')}  ·  Jacqueline Tellechea Assessoria de Eventos`);
  });
}

// ── Lista de Compras do Cliente ───────────────────────────────────────────────

async function buildClientShoppingPdf(e, c) {
  return buildPdf(doc => {
    const theme = e.themeColor || '#B9502C';
    const themeRgb = hexToRgb(theme);
    const [r, g, b] = themeRgb;
    const eventDate = e.date ? dbr(e.date) + (e.time ? ' às ' + e.time : '') : 'Data a confirmar';
    const clientName = e.clientName || 'Cliente';

    // Capa
    drawCover(doc, e, 'Lista de Compras para o Evento', themeRgb);

    // Saudação
    if (doc.y + 46 > PAGE_H - 50) { doc.addPage(); doc.y = MARGIN; }
    const saudY = doc.y;
    doc.rect(MARGIN, saudY, COL_W, 40).fill('#FAF7F2');
    doc.moveTo(MARGIN, saudY).lineTo(MARGIN + COL_W, saudY).strokeColor('#E2D5C0').lineWidth(0.5).stroke();
    doc.moveTo(MARGIN, saudY + 40).lineTo(MARGIN + COL_W, saudY + 40).strokeColor('#E2D5C0').lineWidth(0.5).stroke();
    doc.fillColor('#5C4A2A').font('Helvetica-Bold').fontSize(9)
       .text(`Olá, ${clientName}!`, MARGIN + 10, saudY + 8, { lineBreak: false });
    doc.fillColor('#5C4A2A').font('Helvetica').fontSize(8.5)
       .text('Este documento reúne tudo que precisa ser providenciado para o seu evento. Use a coluna ✓ para marcar o que já foi adquirido.',
             MARGIN + 10, saudY + 22, { width: COL_W - 20, lineBreak: false });
    doc.y = saudY + 50;

    // KPIs resumo
    sectionTitle(doc, 'Resumo do Evento', themeRgb);
    const kpiItems = [
      { label: 'Data',        value: eventDate },
      { label: 'Convidados',  value: c.guestsTotal || c.invitedPeople || 0 },
      { label: 'Confirmados', value: c.confirmedPeople || 0, color: '#2D7A4F' },
    ];
    if ((c.adults || 0) > 0)      kpiItems.push({ label: 'Adultos',   value: c.adults });
    if ((c.kidsUnder10 || 0) > 0) kpiItems.push({ label: 'Crianças',  value: c.kidsUnder10 });
    kpiRow(doc, kpiItems.slice(0, 4), themeRgb);

    // Seção de itens com quantidade
    const itemSection = (title, items) => {
      if (!items || !items.length) return;
      sectionTitle(doc, title, themeRgb);
      table(doc,
        ['Item', 'Quantidade', 'Unidade', 'Observações', '✓'],
        items.map(i => [
          i.name || i.text || '',
          i.qty != null ? (Number(i.qty) % 1 === 0 ? Number(i.qty) : Number(i.qty).toFixed(2)) : '—',
          i.unit || 'unidade',
          i.notes || '',
          '',
        ]),
        [160, 65, 65, 140, 25], themeRgb
      );
    };

    itemSection('Alimentação',          (e.planFood     || []).filter(i => (Number(i.qty) || 0) > 0));
    itemSection('Bebidas',              (e.planDrinks   || []).filter(i => (Number(i.qty) || 0) > 0));
    itemSection('Decoração',            (e.planDecor    || []).filter(i => (Number(i.qty) || 0) > 0));
    itemSection('Materiais e Suprimentos', (e.planMaterials || []).filter(i => (Number(i.qty) || 0) > 0));
    itemSection('Equipe Necessária',    (e.planTeam     || []).filter(i => (Number(i.qty) || 0) > 0));

    // Checklist pendente
    const pendingCheck = (e.checklist || []).filter(i => i.status !== 'Concluido');
    if (pendingCheck.length) {
      sectionTitle(doc, 'Pendentes no Checklist', themeRgb);
      table(doc,
        ['Tarefa', 'Prazo', 'Prioridade', '✓'],
        pendingCheck.map(i => [i.text || '', i.dueDate ? dbr(i.dueDate) : '—', i.priority || '—', '']),
        [240, 80, 100, 25], themeRgb
      );
    }

    // Cronograma
    const schedItems = e.schedule || [];
    if (schedItems.length) {
      sectionTitle(doc, 'Cronograma do Dia', themeRgb);
      table(doc,
        ['#', 'Etapa', 'Hora / Categoria'],
        schedItems.map((i, idx) => [idx + 1, i.text || i.name || '', i.time || i.category || '']),
        [30, 265, 170], themeRgb
      );
    }

    // Aviso se não há itens de planejamento
    const totalItems = (e.planFood||[]).length + (e.planDrinks||[]).length + (e.planDecor||[]).length + (e.planMaterials||[]).length + (e.planTeam||[]).length;
    if (totalItems === 0) {
      doc.y += 10;
      doc.rect(MARGIN, doc.y, COL_W, 44).fill('#FAF7F2');
      doc.fillColor('#8C7B6E').font('Helvetica').fontSize(9)
         .text('Nenhum item de planejamento encontrado. Aplique um Perfil Inteligente ao evento para gerar automaticamente as quantidades de alimentação, bebidas, decoração e equipe.',
               MARGIN + 12, doc.y + 8, { width: COL_W - 24 });
      doc.y += 54;
    }

    // Rodapé
    drawFooter(doc, `Lista gerada em ${new Date().toLocaleString('pt-BR')}  ·  Jacqueline Tellechea Assessoria de Eventos`);
  });
}

module.exports = { buildEventReportPdf, buildClientShoppingPdf };
