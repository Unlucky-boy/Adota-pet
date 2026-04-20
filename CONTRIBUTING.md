# 📖 Guia do Desenvolvedor — Adota Pet

Este documento explica a arquitetura, os fluxos de dados e como contribuir com o projeto.

---

## 🏗️ Arquitetura

O projeto segue a arquitetura **MVC** (Model-View-Controller) com renderização server-side.

```
Usuário (Browser)
  │
  ▼
Express (server.js)
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
| `server.js` | Configura Express, sessão, view engine (EJS), rotas e inicia o servidor |
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
| image_url | TEXT | Caminho da foto |
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
```

---

## 🤝 Como Contribuir

1. Crie uma branch a partir da `main`:
   ```bash
   git checkout -b feature/nome-da-feature
   ```

2. Faça as alterações nos arquivos corretos (veja a estrutura acima).

3. Teste localmente (`npm run dev`).

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

---

## ⚠️ Regras Importantes

1. **Nunca commite o `.env`** — ele contém credentials locais.
2. **Nunca edite `node_modules/`** — use apenas `npm install/add/remove`.
3. **Alterações no banco** devem ser feitas no `seed.sql` e re-executadas com `docker-compose down -v && docker-compose up -d`.
4. **Imagens de pet** vão para `public/uploads/` via Multer. Essa pasta não é commitada (exceto o `.gitkeep`).
