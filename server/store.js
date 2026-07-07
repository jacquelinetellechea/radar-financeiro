/**
 * Camada de dados do Radar Financeiro.
 * Backend flexivel:
 *   - Se existir a variavel de ambiente MONGODB_URI -> grava no MongoDB (permanente).
 *   - Caso contrario -> grava em arquivo JSON local (./data/radar.json).
 * Em ambos os casos os dados sao um unico documento JSON (mesmo modelo).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'radar.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const EMPTY = {
  user: null,
  settings: { currency: 'BRL', theme: 'dark' },
  cards: [],
  installments: [],
  loans: [],
  recurrings: [],
  transactions: [],
  projects: [],
  meta: { createdAt: null, version: 1 }
};

let cache = null;
let backend = 'file';
let mongo = null; // { client, coll }

function fresh() {
  const c = JSON.parse(JSON.stringify(EMPTY));
  c.meta.createdAt = new Date().toISOString();
  return c;
}
function normalize(obj) {
  for (const k of Object.keys(EMPTY)) if (!(k in obj)) obj[k] = JSON.parse(JSON.stringify(EMPTY[k]));
  return obj;
}
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
function loadFileSync() {
  ensureDirs();
  if (fs.existsSync(DATA_FILE)) {
    try { cache = normalize(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); }
    catch (e) { console.error('Falha ao ler data file:', e.message); cache = fresh(); }
  } else {
    cache = fresh();
    writeFileNow();
  }
}
function writeFileNow() {
  ensureDirs();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function fileBackup() {
  try {
    ensureDirs();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `radar-${stamp}.json`));
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
    while (files.length > 30) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  } catch (e) { console.error('Backup falhou:', e.message); }
}

/** Inicializa o backend. Chamar (await) antes de iniciar o servidor. */
async function init() {
  if (process.env.MONGODB_URI) {
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || 'radar_financeiro');
      const coll = db.collection('data');
      mongo = { client, coll };
      backend = 'mongo';
      const doc = await coll.findOne({ _id: 'radar' });
      if (doc && doc.data) cache = normalize(doc.data);
      else { cache = fresh(); await coll.updateOne({ _id: 'radar' }, { $set: { data: cache } }, { upsert: true }); }
      console.log('  Store: MongoDB conectado (dados permanentes).');
      return;
    } catch (e) {
      console.error('  Store: falha ao conectar no MongoDB, usando arquivo local. Detalhe:', e.message);
      backend = 'file';
    }
  }
  loadFileSync();
  console.log('  Store: arquivo local em ' + DATA_FILE);
}

function getData() { if (!cache) loadFileSync(); return cache; }

function mongoWrite() {
  if (!mongo) return Promise.resolve();
  return mongo.coll.updateOne({ _id: 'radar' }, { $set: { data: cache } }, { upsert: true })
    .catch(e => console.error('Mongo save:', e.message));
}

/** Grava o estado atual (imediato). */
function persistNow() {
  if (backend === 'mongo') return mongoWrite();
  writeFileNow();
  return Promise.resolve();
}

// ----- API compativel com o restante do app -----
function save() { persistNow(); }
function scheduleBackup() { persistNow(); }           // grava a cada alteracao
function saveWithBackup() { persistNow(); if (backend === 'file') fileBackup(); }
function id() { return crypto.randomBytes(9).toString('base64url'); }
function replaceAll(newData) {
  cache = normalize(Object.assign(fresh(), newData));
  saveWithBackup();
  return cache;
}

module.exports = {
  DATA_DIR, DATA_FILE, BACKUP_DIR,
  init, getData, save, scheduleBackup, saveWithBackup, id, replaceAll,
  get backend() { return backend; }
};
