# 🐾 Adota Pet

Plataforma web para facilitar o processo de adoção de animais da **ONG Love Patinhas**.

## 📋 Sobre o Projeto

Sistema que permite à ONG cadastrar animais disponíveis para adoção e a pessoas interessadas visualizar, filtrar e solicitar a adoção de forma simples e intuitiva.

## 👥 Equipe — ACE7

| Nome | Papel (Sprint 2) |
|------|-----------------|
| João Gabriel Freitas Euzébio | Product Owner |
| Kácio Gabriel Tenório | Product Owner |
| Alex Da Silva Nunes | Product Owner |
| Guilherme dos Santos Farias | Desenvolvimento |
| José Thiago Tenório Cavalcante | Desenvolvimento |
| Carlos Emanuel Magalhães | Desenvolvimento |
| Sérgio Barros Da Silva Junior | Documentação |
| João Felipe Rufino dos Santos | Documentação |
| Gabriel Ferreira Lima | Documentação |

## 🚀 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + CSS + EJS (templates) |
| Backend | Node.js + Express |
| Banco de Dados | PostgreSQL 16 |
| Upload | Multer |
| Auth | bcrypt + express-session |
| Infra local | Docker Compose |

## ⚡ Início Rápido

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/) e Docker Compose
- [Git](https://git-scm.com/)

### 1. Clone o repositório

```bash
git clone https://github.com/Unlucky-boy/Adota-pet.git
cd Adota-pet
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env se necessário (os valores padrão já funcionam para dev local)
```

### 3. Suba o banco de dados

```bash
docker compose up -d
```

> ⏳ Na primeira execução, o Docker cria o banco e roda o `seed.sql` automaticamente, criando as tabelas e inserindo dados de exemplo.

### 4. Instale as dependências

```bash
npm install
```

### 5. Inicie o servidor

```bash
npm run dev
```

### 6. Acesse no navegador

- **Site público:** http://localhost:3000
- **Login admin:** http://localhost:3000/login
  - **E-mail:** `admin@lovep.com`
  - **Senha:** `admin123`

## 📁 Estrutura do Projeto

```
Adota-pet/
├── src/
│   ├── backend/
│   │   ├── server.js              # Entry point Express
│   │   ├── config/
│   │   │   ├── db.js              # Conexão PostgreSQL
│   │   │   └── seed.sql           # DDL + dados iniciais
│   │   ├── routes/
│   │   │   ├── auth.js            # Login/logout
│   │   │   ├── pets.js            # Pets (público + admin)
│   │   │   ├── adoptions.js       # Solicitações de adoção
│   │   │   ├── adopters.js        # Cadastro de adotante (US11)
│   │   │   ├── donations.js       # Doação financeira (US13)
│   │   │   ├── volunteers.js      # Voluntários (US14/US16)
│   │   │   ├── visits.js          # Agendamento de visita (US15)
│   │   │   └── settings.js        # Configurações do sistema
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── petsController.js
│   │   │   ├── adoptionsController.js
│   │   │   ├── adoptersController.js
│   │   │   ├── donationsController.js
│   │   │   ├── volunteersController.js
│   │   │   ├── visitsController.js
│   │   │   └── settingsController.js
│   │   ├── middlewares/
│   │   │   └── isAuthenticated.js
│   │   └── utils/
│   │       └── cpf.js             # Validação de CPF
│   └── frontend/
│       ├── views/
│       │   ├── layout-header.ejs
│       │   ├── layout-footer.ejs
│       │   ├── home.ejs
│       │   ├── 404.ejs
│       │   ├── partials/
│       │   │   └── pet-card.ejs
│       │   ├── pets/
│       │   ├── auth/
│       │   ├── adoptions/
│       │   ├── register/          # US11 — Cadastro adotante
│       │   ├── donations/         # US13 — Doação financeira
│       │   ├── volunteer/         # US14 — Cadastro voluntário
│       │   └── admin/
│       │       ├── pets.ejs
│       │       ├── pet-form.ejs
│       │       ├── adoptions.ejs
│       │       ├── donations.ejs  # Gerenciar doações
│       │       ├── volunteers.ejs # Aprovar voluntários (US16)
│       │       ├── visits.ejs     # Agendamentos (US15)
│       │       ├── visit-form.ejs
│       │       └── settings.ejs   # Configurações do sistema
│       └── public/
│           ├── css/style.css
│           ├── img/
│           └── uploads/
├── docs/
│   └── SPRINT3.md                 # Documentação da Sprint 3
├── scripts/
│   └── generate-password.js
├── docker-compose.yml
├── package.json
├── .env.example
└── .gitignore
```

## 🗓️ Cronograma de Sprints

| Sprint | Período | Foco |
|--------|---------|------|
| Sprint 1 | Março/2026 | Planejamento e levantamento de requisitos |
| Sprint 2 | Abril/2026 | Infraestrutura e protótipo de alta fidelidade |
| Sprint 3 | Maio/2026 | Implementação das funcionalidades principais |
| Sprint 4 | Junho/2026 | Testes, ajustes e entrega final |

## 📌 Backlog

Acompanhe o backlog e o andamento das sprints na aba [Projects](../../projects) deste repositório.

## 📄 Licença

MIT © 2026 Equipe ACE7 — ONG Love Patinhas
