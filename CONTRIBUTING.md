# 📖 Guia do Desenvolvedor — Adota Pet

Este documento explica a arquitetura, os fluxos de dados e como contribuir com o projeto.

---

## 🏗️ Arquitetura

O projeto segue a arquitetura **MVC** (Model-View-Controller) com renderização server-side.

```
Usuário (Browser)
  │
  ▼
Express (server.js → app.js)
  │
  ├── Middleware de sessão (express-session)
  ├── Middleware isAuthenticated (rotas admin)
  │
  ├── Routes → Controllers → DB (PostgreSQL)
  │
  └── Views EJS → HTML renderizado → Response
```

### Camadas

| Camada | Pasta | Responsabilidade |
|--------|-------|-----------------|
| **Routes** | `src/backend/routes/` | Mapeia URL → Controller |
| **Controllers** | `src/backend/controllers/` | Lógica de negócio |
| **Config** | `src/backend/config/` | Conexão com banco |
| **Middlewares** | `src/backend/middlewares/` | Interceptadores |
| **Views** | `src/frontend/views/` | Templates EJS |
| **Public** | `src/frontend/public/` | CSS, imagens, uploads |

---

## 🔄 Fluxos Principais

### 1. Adoção de um Pet (público)

```
1. Usuário acessa GET /pets
2. Vê a listagem de pets disponíveis (com filtros)
3. Clica em um pet → GET /pets/:id
4. Vê detalhes e preenche o formulário
5. Submete → POST /adoptions
6. Controller verifica se pet está disponível
7. Insere na tabela `adoptions` (status: pending)
8. Redireciona para GET /adoptions/success
```

### 2. Gestão de Pets (admin)

```
1. Admin faz login → POST /login
2. Sessão é criada com dados do usuário
3. Acessa GET /admin/pets → lista todos os pets
4. Pode: Criar (GET /admin/pets/new → POST /admin/pets)
         Editar (GET /admin/pets/:id/edit → POST /admin/pets/:id)
         Remover (POST /admin/pets/:id/delete)
```

### 3. Gestão de Adoções (admin)

```
1. Admin acessa GET /admin/adoptions
2. Vê todas as solicitações com dados do solicitante
3. Pode aprovar (POST /admin/adoptions/:id/status → status: approved)
4. Pode rejeitar (POST /admin/adoptions/:id/status → status: rejected)
5. Ao aprovar, o pet muda para status 'reserved'
```

---

## 📂 Detalhamento dos Arquivos

### Backend

| Arquivo | Responsabilidade |
|---------|-----------------|
| `app.js` | Configura Express, sessão, view engine (EJS) e rotas. Exporta o `app` (usado pelos testes de integração) |
| `server.js` | Lê a porta do ambiente e inicia o servidor HTTP |
| `config/db.js` | Cria pool de conexão com PostgreSQL via `pg` |
| `config/seed.sql` | DDL (tabelas) + dados iniciais. Roda automaticamente no Docker |
| `middlewares/isAuthenticated.js` | Bloqueia acesso às rotas `/admin/*` se não houver sessão |
| `routes/auth.js` | Rotas: GET/POST /login, GET /logout |
| `routes/pets.js` | Rotas públicas (HOME, listagem, detalhe) e admin (CRUD) |
| `routes/adoptions.js` | Rotas de solicitação (público) e gestão (admin) |
| `controllers/authController.js` | Lógica de login com bcrypt |
| `controllers/petsController.js` | CRUD completo de pets com upload multer |
| `controllers/adoptionsController.js` | Criar solicitação, listar e aprovar/rejeitar |

### Frontend

| Arquivo | Responsabilidade |
|---------|-----------------|
| `views/layout-header.ejs` | HEAD + navbar + flash messages |
| `views/layout-footer.ejs` | Footer + scripts |
| `views/home.ejs` | Hero + como funciona + pets em destaque |
| `views/pets/list.ejs` | Listagem com filtros (espécie, porte, gênero) |
| `views/pets/detail.ejs` | Detalhe do pet + formulário de adoção |
| `views/auth/login.ejs` | Login da ONG |
| `views/adoptions/success.ejs` | Confirmação de solicitação |
| `views/admin/pets.ejs` | Dashboard de pets |
| `views/admin/pet-form.ejs` | Form de cadastro/edição |
| `views/admin/adoptions.ejs` | Dashboard de adoções |
| `views/partials/pet-card.ejs` | Card reutilizável de pet |
| `views/404.ejs` | Página de erro |
| `public/css/style.css` | Design system completo |

---

## 🗄️ Banco de Dados

### Tabelas

#### `users`
Membros da ONG que podem acessar o painel admin.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | ID auto-incremento |
| name | VARCHAR(100) | Nome do membro |
| email | VARCHAR(150) UNIQUE | E-mail de login |
| password_hash | TEXT | Hash bcrypt da senha |
| created_at | TIMESTAMP | Data de criação |

#### `pets`
Animais cadastrados pela ONG.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | ID auto-incremento |
| name | VARCHAR(100) | Nome do pet |
| species | VARCHAR(50) | `dog`, `cat`, `other` |
| breed | VARCHAR(100) | Raça (nullable) |
| age_months | INTEGER | Idade em meses (nullable) |
| size | VARCHAR(20) | `small`, `medium`, `large` |
| gender | VARCHAR(10) | `male`, `female` |
| description | TEXT | Descrição do pet |
| image_url | TEXT | URL pública da foto |
| vaccinated | BOOLEAN | Vacinado? |
| neutered | BOOLEAN | Castrado? |
| status | VARCHAR(20) | `available`, `adopted`, `reserved` |
| created_at | TIMESTAMP | Data de criação |

#### `adoptions`
Solicitações de adoção feitas por visitantes.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | ID auto-incremento |
| pet_id | INTEGER FK | Referência ao pet |
| adopter_name | VARCHAR(100) | Nome do adotante |
| adopter_email | VARCHAR(150) | E-mail do adotante |
| adopter_phone | VARCHAR(20) | Telefone (nullable) |
| adopter_address | TEXT | Endereço (nullable) |
| message | TEXT | Mensagem (nullable) |
| status | VARCHAR(20) | `pending`, `approved`, `rejected` |
| created_at | TIMESTAMP | Data de criação |

---

## 🛠️ Scripts Úteis

```bash
# Iniciar servidor de desenvolvimento (com hot reload)
npm run dev

# Iniciar servidor de produção
npm start

# Subir banco PostgreSQL via Docker
docker-compose up -d

# Parar o banco
docker-compose down

# Resetar o banco (apaga os dados e recria)
docker-compose down -v && docker-compose up -d

# Gerar hash bcrypt de uma senha
node scripts/generate-password.js <senha>

# Aplicar o schema e as tabelas operacionais em um banco existente
npm run db:migrate
```

---

## 🧪 Testes Automatizados

Entrega da **US23**: testes unitários e de integração priorizando os fluxos de
**adoção** e **doações**, os módulos mais críticos do sistema.

Usamos o runner nativo do Node (`node --test` + `node:assert/strict`) — sem
framework externo. A única dependência de teste é o `supertest`, necessário
para dirigir o Express por HTTP.

### Rodando

| Comando | O que faz |
|---------|-----------|
| `npm test` | Suíte completa. Sem o banco de teste no ar, a integração é pulada com uma mensagem explicando como subi-lo |
| `npm run test:unit` | Só os unitários — não precisa de Docker |
| `npm run test:integration` | Só a integração — exige `npm run db:test:up` antes |
| `npm run test:watch` | Unitários em modo watch |
| `npm run test:coverage` | Relatório de cobertura |
| `npm run db:test:up` | Sobe o banco de teste (`adotapet-db-test`, porta 5434) |
| `npm run db:test:down` | Remove o container de teste (o banco de dev não é tocado) |

O banco de teste vive atrás do profile `test` do compose, então
`docker compose up -d` continua subindo apenas o banco de desenvolvimento.
Seu data dir é `tmpfs`: a cada start o `seed.sql` roda de novo, garantindo
schema limpo.

### As duas camadas

| Camada | Pasta | Papel |
|--------|-------|-------|
| Unitária | `test/unit/` | O que o controller **decide**: qual ramo seguiu, que flash message definiu, para onde redirecionou, quais params passou |
| Integração | `test/integration/` | O que o **SQL faz**: row locking, o CTE que auto-rejeita adoções concorrentes, upserts e o estado final das tabelas |

Se um teste unitário precisar afirmar sobre o comportamento do SQL, ele
pertence à camada de integração.

### Escrevendo um teste unitário

Use o harness de `test/helpers/controller-harness.js`:

```js
const { createRequest, createResponse, stubDb } = require('../helpers/controller-harness');

let stub;
beforeEach(() => { stub = stubDb(); });
afterEach(() => { stub.restore(); });   // obrigatório: senão o singleton db fica corrompido

test('rejects an adoption request when the pet is unavailable', async () => {
  stub.queueResults({ rows: [] });      // resultados consumidos em ordem
  const req = createRequest({ body: { pet_id: '8' }, session: {} });
  const res = createResponse();

  await adoptionsController.create(req, res);

  assert.equal(stub.matching('INSERT INTO adoptions').length, 0);
  assert.equal(req.session.error, 'Este pet não está mais disponível para adoção.');
});
```

**Regras de asserção:**

- Afirme `params`, flash messages, redirects e o que foi renderizado.
- Use `stub.matching('INSERT INTO ...')` em vez de contar chamadas.
- `stub.calls.length === 0` só quando "não tocou no banco" for o ponto do teste.
- Nunca escreva regex sobre o SQL cru — quebra em reindentação e não prova nada.
- Nomes de teste: frase em inglês, minúscula, descrevendo comportamento.

### Escrevendo um teste de integração

Helpers em `test/helpers/integration-db.js` (reset, fixtures) e
`test/helpers/integration-agent.js` (`anonymous()` e `asAdmin()`).

Duas restrições que não podem ser quebradas:

1. **Os arquivos rodam em série** (`--test-concurrency=1`). Todos compartilham
   o mesmo banco — em paralelo, o reset de um apaga as fixtures de outro.
2. **As suítes só rodam se `DB_NAME` terminar em `_test`.** Isso torna
   impossível um `TRUNCATE` acertar o banco de desenvolvimento.

Flash messages são consumidas na requisição **seguinte** (middleware de locals
do `app.js`): faça `POST` → 302 → `GET` do destino e afirme no corpo. Quando
der para afirmar direto no banco, prefira o banco.

### Problemas conhecidos

- `config/db.js` chama `process.exit(-1)` quando o pool do Postgres emite erro.
  Se o container do banco de teste cair no meio da execução, o processo morre
  com um código de saída cru em vez de falha de teste. Se vir isso, confira se
  o `adotapet-db-test` está de pé.

---

## 🤝 Como Contribuir

1. Crie uma branch a partir da `main`:
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. Faça as alterações nos arquivos corretos (veja a estrutura acima).

3. Teste localmente (`npm run dev`) e rode a suíte (`npm test`).

4. Commit com mensagem em inglês:
   ```bash
   git add .
   git commit -m "feat: add user registration form"
   ```

5. Push e crie um Pull Request:
   ```bash
   git push origin feature/nome-da-feature
   ```

### Convenções de Commit

| Prefixo | Uso |
|---------|-----|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Documentação |
| `style:` | CSS / formatação |
| `refactor:` | Refatoração de código |
| `chore:` | Manutenção / configs |
| `test:` | Testes automatizados |

---

## ⚠️ Regras Importantes

1. **Nunca commite o `.env`** — ele contém credentials locais.
2. **Nunca edite `node_modules/`** — use apenas `npm install/add/remove`.
3. **Alterações no banco** devem ser feitas no `seed.sql` e re-executadas com `docker-compose down -v && docker-compose up -d`.
4. **Imagens de pet** são armazenadas diretamente no banco de dados (BYTEA) e servidas via rota `/pets/:id/image`.
