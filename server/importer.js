/**
 * Importacao de faturas/extratos: CSV e Excel (automatico) e PDF (assistido).
 */
const Papa = require('papaparse');
const XLSX = require('xlsx');

const CATEGORY_RULES = [
  { cat: 'Alimentacao', kw: ['ifood', 'restaurante', 'mercado', 'supermerc', 'padaria', 'lanche', 'burger', 'pizza', 'food', 'coffee', 'cafe'] },
  { cat: 'Transporte', kw: ['uber', '99app', 'posto', 'combustivel', 'gasolina', 'estacion', 'metro', 'onibus', 'shell', 'ipiranga'] },
  { cat: 'Assinaturas', kw: ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'youtube', 'apple.com', 'google', 'prime'] },
  { cat: 'Saude', kw: ['farmacia', 'drogaria', 'hospital', 'clinica', 'medico', 'consulta', 'plano de saude', 'panvel', 'raia'] },
  { cat: 'Compras', kw: ['shopping', 'loja', 'magazine', 'magalu', 'americanas', 'mercadolivre', 'aliexpress', 'shein', 'renner', 'riachuelo'] },
  { cat: 'Moradia', kw: ['aluguel', 'condominio', 'energia', 'luz', 'agua', 'internet', 'vivo', 'claro', 'tim', 'net'] },
  { cat: 'Educacao', kw: ['escola', 'faculdade', 'curso', 'udemy', 'alura'] },
  { cat: 'Lazer', kw: ['cinema', 'viagem', 'hotel', 'airbnb', 'ingresso'] }
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

function detectInstallment(desc) {
  const d = (desc || '');
  let m = d.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
  if (m) {
    const cur = parseInt(m[1], 10), tot = parseInt(m[2], 10);
    if (tot > 1 && cur >= 1 && cur <= tot) return { current: cur, total: tot };
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

const SEC_FUTURE = /(pr[oó]ximas faturas|parcel.+pr[oó]xim)/i;
const SEC_TX = /(lan[çc]amentos?[:\s].*(compra|saque|cart)|compras e saques|compras parceladas|d[ée]bitos e cr[ée]ditos|gastos do periodo|movimenta)/i;
const SEC_STOP = /(limites de cr[eé]dito|encargos cobrados|resumo da fatura|pagamentos efetuados|novo teto|simula[çc]|previs.+fechamento|dados para|composi)/i;
const NOISE = /(^total|total d|limite|saldo|m[ií]nimo|encargos?|juros|multa|\biof\b|pr[oó]xima fatura|demais faturas|dispon[ií]vel|utilizado|anuidade|estorno de|^subtotal)/i;

async function parsePDF(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

  let refYear = new Date().getFullYear(), refMonth = new Date().getMonth() + 1;
  const full = data.text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (full) { refMonth = parseInt(full[2], 10); refYear = parseInt(full[3], 10); }
  const dueISO = full ? `${full[3]}-${full[2]}-${full[1]}` : new Date().toISOString().slice(0, 10);
  const futureDate = (() => { const d = new Date(dueISO); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); })();

  let section = null;
  const items = [];
  const seen = new Set();

  for (const line of lines) {
    if (SEC_STOP.test(line)) { section = null; continue; }
    if (SEC_FUTURE.test(line)) { section = 'future'; continue; }
    if (SEC_TX.test(line)) { section = 'tx'; continue; }
    if (!section) continue;
    if (NOISE.test(line)) continue;

    const m = line.match(/^(\d{2})\/(\d{2})\s*(.+?)\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/);
    if (!m) continue;
    let rawDesc = m[3].replace(/\s{2,}/g, ' ').trim();
    if (!/[a-zA-Z]/.test(rawDesc)) continue;
    const amount = parseAmount(m[4]);
    if (isNaN(amount) || amount === 0) continue;

    const dd = m[1], mm = m[2];
    let year = refYear;
    if (parseInt(mm, 10) > refMonth) year = refYear - 1;
    const date = section === 'future' ? futureDate : `${year}-${mm}-${dd}`;
    const inst = detectInstallment(rawDesc);

    const key = date + '|' + rawDesc + '|' + amount;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      date,
      description: cleanDesc(rawDesc) || rawDesc,
      amount: Math.abs(amount),
      isIncome: amount < 0,
      installment: inst,
      category: guessCategory(rawDesc),
      future: section === 'future'
    });
  }
  return items;
}

module.exports = { parseCSV, parseExcel, parsePDF, guessCategory };
