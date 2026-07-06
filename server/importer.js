/**
 * Importacao de faturas/extratos: CSV e Excel (automatico) e PDF (assistido).
 * Retorna lancamentos detectados para o usuario confirmar antes de salvar.
 */
const Papa = require('papaparse');
const XLSX = require('xlsx');

const CATEGORY_RULES = [
  { cat: 'Alimentacao', kw: ['ifood', 'restaurante', 'mercado', 'supermerc', 'padaria', 'lanche', 'burger', 'pizza', 'food'] },
  { cat: 'Transporte', kw: ['uber', '99', 'posto', 'combustivel', 'gasolina', 'estacion', 'metro', 'onibus'] },
  { cat: 'Assinaturas', kw: ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'youtube', 'apple.com', 'google'] },
  { cat: 'Saude', kw: ['farmacia', 'drogaria', 'hospital', 'clinica', 'medico', 'consulta', 'plano de saude'] },
  { cat: 'Compras', kw: ['shopping', 'loja', 'magazine', 'americanas', 'mercadolivre', 'aliexpress', 'shein'] },
  { cat: 'Moradia', kw: ['aluguel', 'condominio', 'energia', 'luz', 'agua', 'internet', 'vivo', 'claro', 'tim', 'net'] },
  { cat: 'Educacao', kw: ['escola', 'faculdade', 'curso', 'udemy', 'alura'] },
  { cat: 'Lazer', kw: ['cinema', 'bar', 'viagem', 'hotel', 'airbnb', 'ingresso'] }
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
  // formato brasileiro 1.234,56
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

/** Detecta padrao de parcelamento no texto: "3/10", "Parcela 3 de 10". */
function detectInstallment(desc) {
  const d = (desc || '');
  let m = d.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
  if (m) {
    const cur = parseInt(m[1], 10), tot = parseInt(m[2], 10);
    if (tot > 1 && cur >= 1 && cur <= tot) return { current: cur, total: tot };
  }
  return null;
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
  // sem header: tenta colunas posicionais
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

async function parsePDF(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    // procura data + descricao + valor na mesma linha
    const dateMatch = line.match(/(\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?)/);
    const amountMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})\s*$/);
    if (dateMatch && amountMatch) {
      const desc = line.replace(dateMatch[0], '').replace(amountMatch[0], '').trim();
      const amount = parseAmount(amountMatch[1]);
      if (!isNaN(amount) && desc.length > 1) {
        items.push({
          date: parseDate(dateMatch[1]) || new Date().toISOString().slice(0, 10),
          description: desc,
          amount: Math.abs(amount),
          isIncome: false,
          installment: detectInstallment(desc),
          category: guessCategory(desc)
        });
      }
    }
  }
  return items;
}

module.exports = { parseCSV, parseExcel, parsePDF, guessCategory };
