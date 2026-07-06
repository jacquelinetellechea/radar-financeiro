/**
 * Camada de dados do Radar Financeiro.
 * Armazenamento em arquivo JSON unico (sem dependencias nativas / sem banco externo).
 * Ideal para uso privado de um unico usuario. Gravacao atomica + backups automaticos.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'radar.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const EMPTY = {
  user: null,            // { email, passwordHash, createdAt }
  settings: { currency: 'BRL', theme: 'dark' },
  cards: [],             // cartoes de credito
  installments: [],      // compras parceladas no cartao (cada uma gera parcelas)
  loans: [],             // valores emprestados a terceiros (a receber)
  recurrings: [],        // contas / receitas recorrentes
  transactions: [],      // lancamentos avulsos (entradas/saidas pontuais e importados)
  meta: { createdAt: null, version: 1 }
};

let cache = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function load() {
  ensureDirs();
  if (cache) return cache;
  if (fs.existsSync(DATA_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // garante que todas as colecoes existem apos upgrades
      for (const k of Object.keys(EMPTY)) if (!(k in cache)) cache[k] = EMPTY[k];
    } catch (e) {
      console.error('Falha ao ler data file, iniciando vazio:', e.message);
      cache = JSON.parse(JSON.stringify(EMPTY));
    }
  } else {
    cache = JSON.parse(JSON.stringify(EMPTY));
    cache.meta.createdAt = new Date().toISOString();
    save();
  }
  return cache;
}

let saveTimer = null;
function save() {
  ensureDirs();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DATA_FILE); // gravacao atomica
}

/** Salva e cria um backup rotativo (mantem os 30 mais recentes). */
function saveWithBackup() {
  save();
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `radar-${stamp}.json`));
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
    while (files.length > 30) {
      const old = files.shift();
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    }
  } catch (e) {
    console.error('Backup falhou:', e.message);
  }
}

/** Agenda um backup (debounce) para nao gerar arquivo a cada request. */
function scheduleBackup() {
  save();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveWithBackup(), 5000);
}

function id() {
  return crypto.randomBytes(9).toString('base64url');
}

function getData() { return load(); }
function replaceAll(newData) {
  cache = Object.assign(JSON.parse(JSON.stringify(EMPTY)), newData);
  saveWithBackup();
  return cache;
}

module.exports = {
  DATA_DIR, DATA_FILE, BACKUP_DIR,
  load, save, saveWithBackup, scheduleBackup, id, getData, replaceAll
};
