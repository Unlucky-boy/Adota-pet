# 🐾 Adota Pet

Plataforma web para facilitar o processo de adoção de animais da **ONG Love Patinhas**.

> **Status:** MVP funcional e testado, executado **apenas em ambiente local**. Não há deploy público — veja a [justificativa](#-por-que-não-há-deploy-público).

## 📋 Sobre o Projeto

Sistema que permite à ONG cadastrar animais disponíveis para adoção e às pessoas interessadas visualizar, filtrar e solicitar a adoção de forma simples e intuitiva. Além da adoção, o MVP cobre doações via PIX, voluntariado, agendamento de visitas, perfil do adotante com histórico e um painel administrativo com dashboard analítico e trilha de auditoria.

### Funcionalidades

| Módulo | O que faz |
|--------|-----------|
| Pets | Listagem pública com filtros (espécie, porte, gênero) e CRUD administrativo com upload de foto |
| Cadastro e login | Cadastro de adotante com validação de CPF e senha com hash (bcrypt); login da ONG |
| Adoção e visitas | Solicitação de adoção, aprovação/rejeição pela ONG, agendamento de visita domiciliar ou entrevista |
| Doações | Doação via PIX manual: envio de comprovante e confirmação pela ONG (cartão e boleto são simulados) |
| Voluntariado | Inscrição de voluntário e aprovação pela ONG |
| Perfil do adotante (`/profile`) | Dados cadastrais, adoções com status, visitas, voluntariado e histórico de doações — cada usuário vê apenas os próprios dados |
| Dashboard analítico | Métricas por período e 3 relatórios CSV (adoções, doações e financeiro) |
| Operação e Auditoria | Registros veterinários, vacinação, estoque, lares temporários, acolhimento, turnos e despesas, com trilha de auditoria dos valores alterados |

## 👥 Equipe — ACE7

Disciplina ACE6 — Atividade Curricular de Extensão · Professora: Raquel Cabral

| Nome | Papel (Sprint 3) |
|------|------------------|
| Sérgio Barros da Silva Junior | Desenvolvimento |
| Carlos Emanuel Magalhães Silva | Desenvolvimento |
| José Thiago Tenório Cavalcante | Desenvolvimento |
| Gabriel Ferreira Lima | Desenvolvimento |
| Guilherme dos Santos Farias | Product Owner (apoio aos desenvolvedores) |
| Wendell dos Santos | Product Owner (apoio aos desenvolvedores) |
| José Davi Alexandre dos Santos | Product Owner (apoio aos desenvolvedores) |
| João Gabriel Freitas Euzébio | Product Owner e Documentação |
| João Felipe Rufino dos Santos | Documentação |
| Kácio Gabriel Tenório Ferreira da Silva | Documentação |
| Felipe de Almeida Silva | Documentação |

## 🚀 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML + CSS + EJS (templates) |
| Backend | Node.js + Express |
| Banco de Dados | PostgreSQL 16 |
| Upload | Multer |
| Auth | bcrypt + express-session |
| Testes | `node:test` + Supertest |
| Infra local | Docker Compose |

## ⚡ Como rodar localmente

### Pré-requisitos

| Ferramenta | Versão | Observação |
|------------|--------|------------|
| [Node.js](https://nodejs.org/) | v20.6 ou superior | Os testes usam `--env-file` |
| npm | Vem com o Node.js | |
| [Docker](https://www.docker.com/) + Docker Compose | Versão recente | Precisa estar **em execução** para subir o banco e rodar `npm test` |
| [Git](https://git-scm.com/) | Qualquer | |

Portas livres necessárias: **3000** (aplicação), **5433** (PostgreSQL de desenvolvimento) e **5434** (PostgreSQL de teste, só ao rodar os testes).

### 1. Clone o repositório

```bash
git clone https://github.com/Unlucky-boy/Adota-pet.git
cd Adota-pet
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Os valores padrão já funcionam para desenvolvimento local, sem nenhuma edição. Variáveis disponíveis:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta em que a aplicação web sobe |
| `NODE_ENV` | `development` | Ambiente de execução |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5433` | Porta do PostgreSQL no host (mapeada para a 5432 do contêiner) |
| `DB_USER` | `adotapet` | Usuário do banco |
| `DB_PASSWORD` | `adotapet123` | Senha do banco |
| `DB_NAME` | `adotapet` | Nome do banco |
| `SESSION_SECRET` | `mude-esta-chave-em-producao` | Segredo usado para assinar a sessão |

> ⚠️ Esses valores são **somente para desenvolvimento local**. Não os reutilize em nenhum ambiente real.

### 3. Suba o banco de dados

```bash
docker compose up -d
```

Na primeira execução, o Docker cria o banco `adotapet` e roda o `seed.sql` automaticamente, criando as tabelas e inserindo os [dados de teste](#-dados-de-teste).

### 4. Instale as dependências

```bash
npm install
```

### 5. Inicie o servidor

```bash
npm run dev     # desenvolvimento, com reinício automático (nodemon)
# ou
npm start       # execução simples
```

### 6. Acesse no navegador

- **Site público:** http://localhost:3000
- **Login da ONG (admin):** http://localhost:3000/login

### 7. Encerrar e reiniciar do zero

```bash
docker compose down        # para o banco, mantendo os dados
docker compose down -v     # para o banco e APAGA os dados (o seed roda de novo no próximo up)
```

## 🧪 Dados de teste

O `seed.sql` cria, automaticamente, o usuário administrador e 6 pets de exemplo.

**Administrador da ONG**

| Campo | Valor |
|-------|-------|
| E-mail | `admin@lovep.com` |
| Senha | `admin123` |

**Pets de exemplo:** Thor, Luna, Bob, Mel, Rex e Mia (cães e gatos, de portes e idades variados).

**Adotante:** o seed **não** cria adotantes. Para testar os fluxos de adoção, doação, voluntariado e perfil, crie uma conta pelo botão **Cadastre-se** do site. O CPF é validado, então use um CPF válido — por exemplo, `529.982.247-25`, um número de teste comum. A equipe usou a adotante fictícia "Ana Souza (teste)" (`ana.teste@example.com`) nas validações da Sprint 3.

**Roteiro rápido para percorrer o MVP:**

1. Cadastre-se como adotante e faça login (você é levado ao `/profile`).
2. Abra um pet e registre a intenção de adoção.
3. Faça uma doação via PIX e envie um comprovante (qualquer imagem).
4. Inscreva-se como voluntário.
5. Entre em `/login` com o admin: aprove a adoção, agende a visita, confirme a doação e aprove o voluntário.
6. Volte ao perfil do adotante e confira o histórico, e veja o Dashboard e a Auditoria na área da ONG.

## ✅ Testes automatizados

```bash
npm test                  # suíte completa (unitários + integração + funcionais)
npm run test:unit         # só unitários (não precisa de Docker)
npm run test:functional   # fluxos funcionais principais
npm run test:us30         # roteiro de validação do Dashboard e da Auditoria
npm run test:coverage     # relatório de cobertura
```

`npm test` exige o **Docker em execução**. O comando (`scripts/run-tests.js`) sobe um PostgreSQL isolado na porta 5434, executa os testes unitários, de integração e funcionais e remove o contêiner ao terminar, inclusive quando algum teste falha. Se o Docker não estiver disponível, ele avisa com uma mensagem explicando como subi-lo.

Para rodar a integração manualmente:

```bash
npm run db:test:up          # sobe o banco de teste isolado (porta 5434)
npm run test:integration    # testes de integração HTTP
npm run db:test:down        # remove o banco de teste
```

**Resultado ao fim da Sprint 3:** 147 testes aprovados, 22 suítes, 0 falhas, cobertura de 81,2% das linhas de `src/`. Detalhes em [CONTRIBUTING.md](CONTRIBUTING.md#-testes-automatizados).

## 🚫 Por que não há deploy público

O sistema roda **somente em ambiente local**, e isso é uma decisão consciente da equipe, não uma pendência esquecida:

- **Não há ONG parceira formal.** A ONG Love Patinhas é usada como cenário do projeto, e a validação foi feita internamente, com a equipe simulando os papéis de administrador e adotante.
- **Sem parceira, não há quem opere o sistema em produção.** Isso inviabiliza também o cadastro em gateways de pagamento, que exigem uma instituição real.
- **Hospedar custa.** Manter servidor e banco em nuvem gera um custo contínuo que não se justifica para um MVP sem cliente real.
- **Por isso a doação é PIX manual.** A ONG analisa o comprovante enviado e confirma a doação. Cartão e boleto continuam **simulados**, e a integração de pagamento real foi retirada do escopo.

## 📁 Estrutura do Projeto

```
Adota-pet/
├── src/
│   ├── backend/
│   │   ├── server.js              # Entry point: inicia o servidor HTTP
│   │   ├── app.js                 # Configura o Express (rotas, sessão, views)
│   │   ├── config/
│   │   │   ├── db.js              # Conexão PostgreSQL
│   │   │   └── seed.sql           # DDL + dados iniciais
│   │   ├── routes/                # auth, pets, adoptions, adopters, donations,
│   │   │                          # volunteers, visits, dashboard, operations, settings
│   │   ├── controllers/           # Um controller por rota (lógica de negócio)
│   │   ├── middlewares/
│   │   │   ├── isAuthenticated.js        # Protege as rotas da ONG (/admin)
│   │   │   └── isAdopterAuthenticated.js # Protege o perfil do adotante (/profile)
│   │   └── utils/
│   │       └── cpf.js             # Validação de CPF
│   └── frontend/
│       ├── views/                 # Templates EJS (público, admin, perfil, dashboard)
│       └── public/                # CSS, imagens e uploads
├── test/
│   ├── helpers/                   # Harness unitário e infra de integração
│   ├── unit/                      # Testes de controller com banco mockado
│   └── integration/               # Testes HTTP contra PostgreSQL real
├── docs/                          # Documentação (roteiro de validação e registro de issues da US30, entre outros)
├── scripts/
│   ├── run-tests.js               # Sobe o banco de teste, roda a suíte e remove o contêiner
│   ├── migrate-db.js              # Migração do banco
│   └── generate-password.js       # Gera hash bcrypt de senha
├── docker-compose.yml
├── package.json
├── .env.example
└── .gitignore
```

## 🗓️ Cronograma de Sprints

| Sprint | Período | Foco | Situação |
|--------|---------|------|----------|
| Sprint 1 | Março/2026 | Planejamento e levantamento de requisitos | Concluída |
| Sprint 2 | Abril/2026 | Infraestrutura e protótipo de alta fidelidade | Concluída |
| Sprint 3 | 01 a 20/10/2026 | Consolidação, testes e validação do MVP (perfil do adotante, validação do Dashboard e da Auditoria, correção de 7 bugs) | Concluída |
| Próxima etapa | A definir | Documentação e entrega final | Em andamento |

## 🔧 Pendências conhecidas

- Perfil do adotante (`/profile`) ainda estoura a largura em celular (390 px): o card de visita e a tabela de doações ficam cortados.
- Redesign da navegação em abas da tela de Operação/Auditoria (backlog futuro).
- Cobertura de testes baixa em alguns módulos: pets (23,8%), configurações (34,3%) e voluntários (56,0%).
- Deploy e pagamento real: fora do escopo (ver [justificativa](#-por-que-não-há-deploy-público)).

## 📌 Backlog

Acompanhe o backlog e o andamento das sprints na aba [Projects](../../projects) deste repositório.

## 📄 Licença

MIT © 2026 Equipe ACE7 — ONG Love Patinhas
