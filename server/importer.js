/**
 * Importacao de faturas/extratos: CSV e Excel (automatico) e PDF (assistido).
 */
const Papa = require('papaparse');
const XLSX = require('xlsx');

const CATEGORY_RULES = [
  { cat: 'Alimentacao', kw: ['ifood', 'ifd', 'restaurante', 'mercado', 'supermerc', 'padaria', 'lanche', 'burger', 'pizza', 'food', 'coffee', 'cafe', 'zaffari', 'joao'] },
  { cat: 'Transporte', kw: ['uber', '99app', '99*', '99food', 'posto', 'combustivel', 'gasolina', 'estacion', 'metro', 'onibus', 'shell', 'ipiranga'] },
  { cat: 'Assinaturas', kw: ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'youtube', 'apple.com', 'google', 'prime'] },
  { cat: 'Saude', kw: ['farmacia', 'drogaria', 'hospital', 'clinica', 'medico', 'consulta', 'plano de saude', 'panvel', 'raia', 'boticario', 'obotic'] },
  { cat: 'Compras', kw: ['shopping', 'loja', 'magazine', 'magalu', 'americanas', 'mercadolivre', 'aliexpress', 'shein', 'renner', 'riachuelo', 'loja7'] },
  { cat: 'Moradia', kw: ['aluguel', 'condominio', 'energia', 'luz', 'agua', 'internet', 'vivo', 'claro', 'tim', 'net'] },
  { cat: 'Educacao', kw: ['escola', 'faculdade', 'curso', 'udemy', 'alura'] },
  { cat: 'Lazer', kw: ['cinema', 'viagem', 'hotel', 'airbnb', 'ingresso'] },
  { cat: 'Tarifas', kw: ['anuidade', 'seguro', 'segcartao', 'envio mens', 'tarifa'] }
];

function guessCategory(desc) {
  const d = (desc || '').toLowerCase();
  for (const rule of CATEGORY_RULES) if (rule.kw.some(k => d.includes(k))) return rule.cat;
  return 'Outros';
}

function parseAmount(v) {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

function parseDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

/** Detecta parcela: "3/10", "02/03", "Parcela 3 de 10". Ignora casos improvaveis. */
function detectInstallment(desc) {
  const m = (desc || '').match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
  if (m) {
    const cur = parseInt(m[1], 10), tot = parseInt(m[2], 10);
    if (tot > 1 && tot <= 48 && cur >= 1 && cur <= tot) return { current: cur, total: tot };
  }
  return null;
}

function cleanDesc(desc) {
  return String(desc || '').replace(/\s*\d{1,2}\s*\/\s*\d{1,2}\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function normalizeRows(rows) {
  const items = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const lower = {};
    for (const k of keys) lower[k.toLowerCase().trim()] = row[k];
    const dateVal = lower['data'] || lower['date'] || lower['data da compra'] || row[keys[0]];
    const descVal = lower['descricao'] || lower['descrição'] || lower['description'] || lower['lancamento'] || lower['lançamento'] || lower['estabelecimento'] || lower['title'] || row[keys[1]];
    let amountVal = lower['valor'] || lower['amount'] || lower['value'] || lower['valor (r$)'] || row[keys[2]];
    const date = parseDate(dateVal);
    const amount = parseAmount(amountVal);
    if (!descVal && isNaN(amount)) continue;
    const inst = detectInstallment(descVal);
    items.push({
      date: date || new Date().toISOString().slice(0, 10),
      description: String(descVal || '').trim(),
      amount: isNaN(amount) ? 0 : Math.abs(amount),
      isIncome: amount < 0 && String(descVal || '').toLowerCase().includes('pagamento'),
      installment: inst,
      category: guessCategory(descVal)
    });
  }
  return items;
}

function parseCSV(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.data && parsed.data.length && Object.keys(parsed.data[0]).length > 1) {
    return normalizeRows(parsed.data);
  }
  const noHeader = Papa.parse(text, { header: false, skipEmptyLines: true });
  const rows = (noHeader.data || []).map(cols => ({ data: cols[0], descricao: cols[1], valor: cols[2] }));
  return normalizeRows(rows);
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return normalizeRows(rows);
}

// Linhas que NAO sao compras (resumos, totais, pagamentos da fatura).
const NOISE = /(pagamento|^total|total d|limite|saldo|m[ií]nimo|pr[oó]xima fatura|demais faturas|dispon[ií]vel|utilizado|estorno|subtotal|lan[çc]amento|\bcet\b|valor total financiado|valor solicitado)/i;
// Linhas que sao encargos (juros, multa, IOF) - capturadas como categoria especial
const ENCARGO = /(encargo|juros|multa|\biof\b)/i;

/**
 * PDF de fatura (assistido). Detecta compras pelo padrao "DD/MM ... valor",
 * independente da ordem/secoes do PDF. Colapsa parcelas repetidas da mesma compra.
 */
/** Separa descricao + parcela (CC/TT, possivelmente grudada no valor) + valor. */
function splitDescInstAmount(rest) {
  // 1) parcela CC/TT grudada logo antes do valor: ...DESC CC/TT VALOR
  let m = rest.match(/^(.*?)(\d{1,2})\/(\d{1,2})(\d{1,3}(?:\.\d{3})*,\d{2})$/);
  if (m) {
    const cur = parseInt(m[2], 10), tot = parseInt(m[3], 10);
    if (tot > 1 && tot <= 48 && cur >= 1 && cur <= tot) {
      return { desc: m[1], installment: { current: cur, total: tot }, amount: parseAmount(m[4]) };
    }
  }
  // 2) valor no fim; parcela (se houver) separada por espaco na descricao
  m = rest.match(/^(.*?)(-?\d{1,3}(?:\.\d{3})*,\d{2})$/);
  if (m) {
    const inst = detectInstallment(m[1]);
    return { desc: inst ? cleanDesc(m[1]) : m[1], installment: inst, amount: parseAmount(m[2]) };
  }
  return null;
}

async function parsePDF(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);


  // ano/mes de referencia (a partir da 1a data completa: vencimento/fechamento)
  let refYear = new Date().getFullYear(), refMonth = new Date().getMonth() + 1;
  const full = data.text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (full) { refMonth = parseInt(full[2], 10); refYear = parseInt(full[3], 10); }

  const MESES = { 'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12' };

  const raw = [];
  for (const line of lines) {
    if (NOISE.test(line)) continue;
    const isEncargo = ENCARGO.test(line);
    // Tenta formato padrão DD/MM ou o formato do Banco Inter: DD de MMM. AAAA
    let dd, mm, year = refYear, rest;
    const headPadrao = line.match(/^(\d{2})\/(\d{2})\s*(.+)$/);
    // No Inter o texto vem grudado: '05 de jun. 2026Estapar Reserva 25NCSD-R$ 55,00'
    const headInter = line.match(/^(\d{2})\s+de\s+([a-z]{3})\.?\s+(\d{4})(.*)$/i);
    
    if (headPadrao) {
      dd = headPadrao[1]; mm = headPadrao[2]; rest = headPadrao[3];
      if (parseInt(mm, 10) > refMonth) year = refYear - 1; // compra do ano anterior
    } else if (headInter) {
      dd = headInter[1];
      const mesExt = headInter[2].toLowerCase();
      mm = MESES[mesExt] || '01';
      year = parseInt(headInter[3], 10);
      rest = headInter[4];
      // O Inter coloca um hífen no beneficiário grudado no valor, vamos removê-lo
      rest = rest.replace(/-\+?\s*R\$\s*/, ' ');
      // Para crédito, pode ter -+ R$
      rest = rest.replace(/-\+\s*R\$\s*/, ' -');
    } else {
      continue;
    }

    // O Inter pode colocar "R$" com espaço e também sinal de "+" para crédito
    // Também temos que lidar com "R$ 55,00" ou "+ R$ 1.000,00" ou "R$ -50,00"
    rest = rest.replace(/\+\s*R\$\s*/, '-').replace(/R\$\s*/, '').replace(/\s+/g, ' ');
    
    const parsed = splitDescInstAmount(rest.trim());
    if (!parsed) continue;
    let desc = parsed.desc.replace(/\s{2,}/g, ' ').trim();
    if (desc.replace(/[^a-zA-Z]/g, '').length < 3) continue; // precisa ter nome real
    const amount = parsed.amount;
    if (isNaN(amount) || amount === 0) continue;
    raw.push({ date: `${year}-${mm}-${dd}`, rawDesc: desc, amount: Math.abs(amount), isIncome: amount < 0, installment: parsed.installment, isEncargo });
  }

  // colapsa parcelas repetidas da mesma compra: mantem a de menor "current"
  const byKey = {};
  const out = [];
  for (const r of raw) {
    if (r.installment) {
      const k = cleanDesc(r.rawDesc).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + r.amount.toFixed(2) + '|' + r.installment.total;
      if (!byKey[k] || r.installment.current < byKey[k].installment.current) byKey[k] = r;
    } else {
      out.push(r);
    }
  }
  Object.values(byKey).forEach(r => out.push(r));

  return out.map(r => ({
    date: r.date,
    description: cleanDesc(r.rawDesc) || r.rawDesc,
    amount: r.amount,
    isIncome: r.isIncome,
    installment: r.installment,
    isEncargo: !!r.isEncargo,
    category: r.isEncargo ? 'Encargos' : guessCategory(r.rawDesc)
  }));
}

module.exports = { parseCSV, parseExcel, parsePDF, guessCategory };
