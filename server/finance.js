/**
 * Funcoes de calculo financeiro: datas de fatura, geracao de parcelas,
 * distribuicao em meses e projecao de fluxo de caixa.
 */

function pad(n) { return String(n).padStart(2, '0'); }

/** Chave de mes no formato YYYY-MM. */
function monthKey(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Retorna Date no ultimo dia possivel do mes se o dia nao existir (ex: dia 31 em fev). */
function safeDate(year, monthIndex, day) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, last));
}

/** Soma meses a uma chave YYYY-MM. */
function addMonthsToKey(key, months) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return monthKey(d);
}

/**
 * Calcula a data de vencimento da PRIMEIRA fatura para uma compra no cartao.
 * closingDay = dia de fechamento, dueDay = dia de vencimento.
 * Regra: compra ate o fechamento entra na fatura que fecha neste mes;
 * senao entra na proxima. O vencimento cai no mes do fechamento se dueDay>closingDay,
 * caso contrario no mes seguinte.
 */
function firstInvoiceDueDate(purchaseDate, closingDay, dueDay) {
  const p = (purchaseDate instanceof Date) ? purchaseDate : new Date(purchaseDate);
  let closeYear = p.getFullYear();
  let closeMonth = p.getMonth(); // 0-based
  if (p.getDate() > closingDay) {
    // entra no proximo ciclo
    closeMonth += 1;
  }
  // vencimento
  let dueYear = closeYear;
  let dueMonth = closeMonth;
  if (dueDay <= closingDay) dueMonth += 1; // vence no mes seguinte ao fechamento
  return safeDate(dueYear, dueMonth, dueDay);
}

/** Divide um valor total em N parcelas ajustando centavos na ultima. */
function splitAmount(total, n) {
  const base = Math.floor((total * 100) / n) / 100;
  const parts = Array(n).fill(base);
  const soma = base * n;
  const resto = Math.round((total - soma) * 100) / 100;
  parts[n - 1] = Math.round((base + resto) * 100) / 100;
  return parts;
}

/**
 * Gera as parcelas de uma compra parcelada no cartao.
 * Retorna array de { number, dueDate (ISO), month (YYYY-MM), amount, paid }.
 */
function generateCardInstallments(purchaseDate, closingDay, dueDay, total, n) {
  const first = firstInvoiceDueDate(purchaseDate, closingDay, dueDay);
  const amounts = splitAmount(total, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const due = safeDate(first.getFullYear(), first.getMonth() + i, dueDay);
    items.push({
      number: i + 1,
      dueDate: monthKey(due) + '-' + pad(dueDay),
      dueISO: due.toISOString().slice(0, 10),
      month: monthKey(due),
      amount: amounts[i],
      paid: false,
      paidDate: null
    });
  }
  return items;
}

/**
 * Gera parcelas simples a partir de uma primeira data de vencimento (para emprestimos/recorrentes finitos).
 */
function generateSchedule(firstDueISO, total, n, dayOverride) {
  const first = new Date(firstDueISO);
  const day = dayOverride || first.getDate();
  const amounts = splitAmount(total, n);
  const items = [];
  for (let i = 0; i < n; i++) {
    const due = safeDate(first.getFullYear(), first.getMonth() + i, day);
    items.push({
      number: i + 1,
      dueISO: due.toISOString().slice(0, 10),
      month: monthKey(due),
      amount: amounts[i],
      settled: false,      // pago/recebido
      settledDate: null
    });
  }
  return items;
}

module.exports = {
  pad, monthKey, safeDate, addMonthsToKey,
  firstInvoiceDueDate, splitAmount,
  generateCardInstallments, generateSchedule
};
