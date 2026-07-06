# INSTRUÇÕES PARA A MANUS — Radar Financeiro

> Objetivo: **apenas EXECUTAR e publicar** este projeto. Todo o código já está escrito e testado.
> Não reescreva nada. Não gere código novo. Isso mantém o consumo de créditos no mínimo.

## O que é
Aplicação web completa (backend + frontend) de gestão financeira pessoal para **um único usuário**.
Stack: **Node.js + Express** (backend/API) e **HTML/JS + Tailwind + Chart.js** (frontend, sem etapa de build).
Banco de dados: **arquivo JSON local** (`data/radar.json`) — não precisa de MySQL/Postgres/nada externo.

## Passo a passo (copie e cole)
```bash
# 1. Instalar dependências (leva alguns segundos)
npm install

# 2. (OPCIONAL) Criar dados de exemplo para demonstração
#    Cria o login demo@radar.com / senha: radar123
npm run seed

# 3. Iniciar o servidor
npm start
```
Depois abra: **http://localhost:3000**

## Configuração (recomendado antes de publicar)
1. Copie `.env.example` para `.env`.
2. Em `.env`, troque `JWT_SECRET` por uma string aleatória longa. Gere com:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Ajuste `PORT` se necessário (padrão 3000).

## Primeiro acesso
- Se **NÃO** rodou `npm run seed`: a primeira tela permite **criar a conta** (e-mail + senha). O primeiro cadastro vira o dono do sistema.
- Se rodou o seed: entre com **demo@radar.com / radar123** (troque a senha em Configurações).

## Publicar online (qualquer uma serve)
O app é um servidor Node padrão que escuta em `process.env.PORT`. Opções:
- **Render / Railway / Fly.io / VPS**: build command `npm install`, start command `npm start`.
- Variáveis de ambiente: defina `JWT_SECRET` (obrigatório) e, se a plataforma exigir, `PORT`.
- **Persistência**: a pasta `data/` guarda TODOS os dados. Em plataformas efêmeras (Render free, etc.), monte um **volume/disco persistente** apontando `DATA_DIR` para ele. Ex.: `DATA_DIR=/data`.

## Checklist de verificação (rápido)
- [ ] `npm start` sobe sem erro e mostra "Radar Financeiro rodando em ...".
- [ ] http://localhost:3000 abre a tela de login/cadastro.
- [ ] Após login, o Dashboard carrega com gráficos.
- [ ] Criar um cartão e uma compra parcelada gera as parcelas automaticamente.

## O que NÃO fazer
- ❌ Não trocar o banco JSON por um SGBD (não é necessário e quebra o projeto).
- ❌ Não adicionar framework de frontend / etapa de build (o frontend é estático de propósito).
- ❌ Não reescrever os arquivos em `server/` ou `public/`.

## Estrutura
```
radar-financeiro/
├── server/           # backend Express (API) + lógica financeira
│   ├── index.js      # servidor + todas as rotas
│   ├── store.js      # banco JSON + backups automáticos
│   ├── finance.js    # geração de parcelas e datas de fatura
│   ├── projection.js # dashboard, fluxo de caixa, relatórios, alertas
│   ├── importer.js   # importação CSV/Excel/PDF
│   └── seed.js       # dados de exemplo
├── public/           # frontend (index.html, app.js, styles.css)
├── package.json
├── .env.example
└── README.md
```
Pronto. Basta `npm install && npm start`.
