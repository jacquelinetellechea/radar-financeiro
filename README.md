# 📡 Radar Financeiro
### *"Tudo o que você vai pagar, antes de precisar pagar."*

Centro de inteligência financeira pessoal para quem usa **muitos cartões de crédito**.
Elimina planilhas e lançamentos repetitivos: você cadastra uma vez, o sistema projeta o futuro.

Aplicação **privada, para um único usuário**. Backend Node.js/Express + frontend estático (sem build).
Dados salvos localmente em arquivo JSON com backups automáticos.

---

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Dashboard** | Saldo atual, receitas/despesas previstas, próximas faturas, comprometido futuro, limites por cartão, valores a receber, alertas e gráficos de evolução. |
| **Cartões de crédito** | Cadastro ilimitado (nome, banco, limite, fechamento, vencimento). Mostra limite disponível/comprometido, fatura atual e histórico. |
| **Parcelamentos inteligentes** | Cadastre 1 compra parcelada → o sistema gera **todas** as parcelas nos meses corretos e atualiza as projeções. Zero lançamento manual futuro. |
| **Empréstimos a terceiros** | Controla o que você emprestou: total, recebido, pendente, parcelas vencidas/futuras. Pode gerar em paralelo a fatura do cartão que **você** paga e o reembolso que o familiar deve. |
| **Valores a receber** | Painel de devedores com próximo vencimento e status (em dia/atrasado/quitado). |
| **Calendário financeiro** | Visão mensal de receitas, despesas, faturas, parcelas e recebimentos. Navega entre meses. |
| **Fluxo de caixa projetado** | Projeção de 12/24/36 meses: entradas, saídas, saldo e meses de risco. |
| **Contas recorrentes** | Cadastro único (aluguel, energia, streaming...) replicado automaticamente todo mês. |
| **Importação** | CSV e Excel automáticos; PDF de fatura assistido (você confirma os lançamentos detectados). Detecta parcelamentos, recorrências e categorias. |
| **Relatórios** | Gastos por categoria, cartões mais usados, emprestado/recebido, fluxo de caixa. |
| **Simulador** | "Se eu parcelar R$ X em Nx, como ficam meus próximos meses?" — resposta visual antes de comprar. |
| **Segurança** | Login por senha (hash bcrypt), sessão com token JWT, backup automático (30 versões) e exportação/importação completa dos dados. |

---

## Como rodar

```bash
npm install
npm start
```
Abra **http://localhost:3000** e crie sua conta no primeiro acesso.

Quer ver com dados de exemplo antes? Rode `npm run seed` (login `demo@radar.com` / senha `radar123`).

> Configuração recomendada: copie `.env.example` para `.env` e troque a `JWT_SECRET`.
> Detalhes de publicação em **INSTRUCOES_MANUS.md**.

---

## Como funcionam as parcelas (exemplo)
Compra de **R$ 3.600 em 12x** no Nubank (fecha dia 3, vence dia 10), feita em julho:
o sistema cria 12 parcelas de R$ 300, aloca cada uma no mês de fatura correto (a 1ª na fatura
que vence em agosto) e soma tudo nas projeções de fluxo de caixa e no limite comprometido do cartão.

## Tecnologia
- **Backend:** Node.js + Express. Sem dependências nativas (instalação à prova de falhas).
- **Dados:** arquivo JSON (`data/radar.json`) + backups em `data/backups/`.
- **Frontend:** HTML + JavaScript puro, Tailwind (CDN) e Chart.js (CDN). Sem etapa de build.
- **Design:** interface escura, moderna e responsiva, inspirada em Notion / Mobills / Organizze / YNAB.

## Privacidade e backup
Todos os dados ficam no seu servidor, no arquivo `data/radar.json`. Em **Configurações** você pode
exportar tudo em JSON a qualquer momento e reimportar. O sistema também mantém backups automáticos
rotativos das últimas 30 alterações.
