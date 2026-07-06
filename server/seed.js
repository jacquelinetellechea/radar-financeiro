/**
 * Popula o Radar Financeiro com dados de exemplo para demonstracao.
 * Uso: npm run seed   (cria usuario demo@radar.com / senha: radar123)
 */
const bcrypt = require('bcryptjs');
const store = require('./store');
const fin = require('./finance');

const d = store.getData();
d.user = { email: 'demo@radar.com', passwordHash: bcrypt.hashSync('radar123', 10), createdAt: new Date().toISOString() };
d.settings = { currency: 'BRL', theme: 'dark', currentBalance: 4500 };
d.cards = []; d.installments = []; d.loans = []; d.recurrings = []; d.transactions = [];

function card(name, bank, limit, closing, due, color) {
  const c = { id: store.id(), name, bank, limitTotal: limit, closingDay: closing, dueDay: due, color, createdAt: new Date().toISOString() };
  d.cards.push(c); return c;
}
const nubank = card('Nubank', 'Nu Pagamentos', 8000, 3, 10, '#820ad1');
const itau = card('Itau Click', 'Itau', 12000, 20, 28, '#ec7000');
const inter = card('Inter Gold', 'Banco Inter', 5000, 15, 22, '#ff7a00');

function purchase(cardObj, desc, cat, date, total, n) {
  const items = fin.generateCardInstallments(date, cardObj.closingDay, cardObj.dueDay, total, n);
  d.installments.push({ id: store.id(), cardId: cardObj.id, description: desc, category: cat, purchaseDate: date, totalAmount: total, numInstallments: n, items, createdAt: new Date().toISOString() });
}
const today = new Date().toISOString().slice(0, 10);
purchase(nubank, 'Notebook Dell', 'Compras', today, 3600, 12);
purchase(nubank, 'Mercado do mes', 'Alimentacao', today, 780, 1);
purchase(itau, 'Passagens aereas', 'Lazer', today, 2400, 6);
purchase(itau, 'Geladeira', 'Casa', today, 4200, 10);
purchase(inter, 'Tenis', 'Compras', today, 599, 3);

// Emprestimo a familiar (celular parcelado em 10x, pago no Nubank)
const loanFirst = new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10);
const loanItems = fin.generateSchedule(loanFirst, 2400, 10);
const loan = { id: store.id(), person: 'Irmao Pedro', description: 'Celular Samsung', totalAmount: 2400, numInstallments: 10, method: 'Cartao Nubank', cardId: nubank.id, items: loanItems, createdAt: new Date().toISOString() };
d.loans.push(loan);
purchase(nubank, 'Emprestimo p/ Pedro: Celular', 'Emprestimo', today, 2400, 10);
d.installments[d.installments.length - 1].linkedLoanId = loan.id;

// Recorrentes
function rec(type, desc, cat, amount, day) {
  d.recurrings.push({ id: store.id(), type, description: desc, category: cat, amount, dayOfMonth: day, startMonth: fin.monthKey(new Date()), endMonth: null, active: true, createdAt: new Date().toISOString() });
}
rec('income', 'Salario', 'Renda', 9500, 5);
rec('expense', 'Aluguel', 'Moradia', 2200, 10);
rec('expense', 'Energia', 'Moradia', 240, 15);
rec('expense', 'Internet', 'Moradia', 120, 20);
rec('expense', 'Netflix', 'Assinaturas', 55, 8);
rec('expense', 'Academia', 'Saude', 130, 5);
rec('expense', 'Plano de saude', 'Saude', 480, 12);

store.saveWithBackup();
console.log('Dados de exemplo criados. Login: demo@radar.com / senha: radar123');
