# 🐾 Adota Pet

Plataforma web para facilitar o processo de adoção de animais da **ONG Love Patinhas**.

## 📋 Sobre o Projeto

Sistema que permite à ONG cadastrar animais disponíveis para adoção e a pessoas interessadas visualizar, filtrar e solicitar a adoção de forma simples e intuitiva.

## 👥 Equipe — ACE6

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
docker-compose up -d
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
│   │   │   ├── auth.js            # Rotas de login/logout
│   │   │   ├── pets.js            # Rotas de pets (público + admin)
│   │   │   └── adoptions.js       # Rotas de adoções
│   │   ├── controllers/
│   │   │   ├── authController.js  # Lógica de autenticação
│   │   │   ├── petsController.js  # CRUD de pets
│   │   │   └── adoptionsController.js # Gestão de adoções
│   │   └── middlewares/
│   │       └── isAuthenticated.js # Proteção de rotas admin
│   └── frontend/
│       ├── views/                 # Templates EJS
│       │   ├── layout-header.ejs  # Cabeçalho HTML
│       │   ├── layout-footer.ejs  # Rodapé HTML
│       │   ├── home.ejs           # Página inicial
│       │   ├── 404.ejs            # Página de erro
│       │   ├── partials/
│       │   │   └── pet-card.ejs   # Card reutilizável
│       │   ├── pets/
│       │   │   ├── list.ejs       # Listagem com filtros
│       │   │   └── detail.ejs     # Detalhe + form adoção
│       │   ├── auth/
│       │   │   └── login.ejs      # Login da ONG
│       │   ├── adoptions/
│       │   │   └── success.ejs    # Confirmação
│       │   └── admin/
│       │       ├── pets.ejs       # Dashboard de pets
│       │       ├── pet-form.ejs   # Cadastro/edição
│       │       └── adoptions.ejs  # Dashboard de adoções
│       └── public/
│           ├── css/style.css      # Design system
│           ├── img/               # Imagens estáticas
│           └── uploads/           # Uploads de fotos
├── scripts/
│   └── generate-password.js       # Gerar hash bcrypt
├── docker-compose.yml             # PostgreSQL via Docker
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

MIT © 2026 Equipe ACE6 — ONG Love Patinhas
