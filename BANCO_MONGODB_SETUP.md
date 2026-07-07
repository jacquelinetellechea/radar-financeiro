# Deixar os dados permanentes com MongoDB Atlas (grátis)

Com isso, o Radar Financeiro passa a guardar tudo num banco na nuvem. Você pode
atualizar/republicar o app à vontade que **os dados não somem** (igual a um app profissional).
Custo: **R$ 0** (plano gratuito M0, 512 MB, que não expira).

## Passo 1 — Criar a conta e o cluster grátis
1. Acesse **mongodb.com/cloud/atlas/register** e crie uma conta (pode ser com Google).
2. Em "Deploy a database", escolha o plano **M0 (FREE)** e clique em **Create**.
3. Escolha um provedor/região qualquer próxima (ex.: AWS / São Paulo) e confirme.

## Passo 2 — Usuário e senha do banco
1. Na tela "Security Quickstart" (ou menu **Database Access**), crie um usuário:
   - Username: por ex. `radar`
   - Password: gere uma senha (anote — você vai usar já já). Evite caracteres como @ : / para não atrapalhar a URL.
2. Salve (Create User).

## Passo 3 — Liberar acesso de rede
1. Vá em **Network Access** → **Add IP Address**.
2. Clique em **Allow access from anywhere** (0.0.0.0/0) e confirme.
   (É necessário porque o Render usa IPs variáveis. O banco continua protegido por usuário e senha.)

## Passo 4 — Copiar a "connection string"
1. Vá em **Database** → botão **Connect** no seu cluster → **Drivers**.
2. Copie a URL parecida com:
   `mongodb+srv://radar:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
3. **Troque `<db_password>`** pela senha que você criou no Passo 2.

## Passo 5 — Colar no Render
1. No painel do Render, abra o serviço do Radar → aba **Environment**.
2. Clique em **Add Environment Variable** e adicione:
   - Key: `MONGODB_URI`  → Value: a URL completa do Passo 4.
   - (opcional) Key: `MONGODB_DB` → Value: `radar_financeiro`
3. Salve. O Render vai reiniciar o serviço sozinho.

Pronto! Na inicialização, o log do Render vai mostrar **"Store: MongoDB conectado (dados permanentes)"**.
A partir daí, seus dados ficam no banco e sobrevivem a qualquer atualização.

> Dica: se um dia quiser conferir, dá pra ver os dados no próprio Atlas em
> **Database → Browse Collections → radar_financeiro → data**.

## E se eu não configurar isso?
O app continua funcionando, mas no modo arquivo local (que no plano free do Render
pode ser resetado em reinícios). Ou seja: **para não perder dados, faça este setup.**
