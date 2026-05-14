# 📋 Documentação Sprint 3 — Funcionalidades Implementadas

> **Data:** 14/05/2026
> **Responsável:** Guilherme dos Santos Farias
> **Branch:** Sprint 3 — Implementação das funcionalidades principais

---

## 📌 User Stories Implementadas

| US   | Título                         | Prioridade | Status         |
|------|--------------------------------|------------|----------------|
| US02 | Login de usuário (ONG)         | Alta       | ✅ Já existia, validado |
| US11 | Cadastro de adotante           | Alta       | ✅ Implementado |
| US13 | Doação financeira              | Alta       | ✅ Implementado |
| US14 | Cadastro de voluntário         | Média      | ✅ Implementado |
| US15 | Agendamento de visita          | Média      | ✅ Implementado |
| US16 | Aprovação de voluntário        | Média      | ✅ Implementado |

---

## 🗂️ Arquivos Criados

### Backend — Controllers
| Arquivo | Descrição |
|---------|-----------|
| `src/backend/controllers/adoptersController.js` | Cadastro de adotante com validação de CPF e unicidade |
| `src/backend/controllers/donationsController.js` | Doação financeira com PIX dinâmico, upload comprovante, painel admin |
| `src/backend/controllers/settingsController.js` | Configurações do sistema (chave PIX, e-mail do projeto) |
| `src/backend/controllers/volunteersController.js` | Inscrição voluntário + painel admin de aprovação/rejeição |
| `src/backend/controllers/visitsController.js` | CRUD de agendamento de visitas domiciliares/entrevistas |

### Backend — Routes
| Arquivo | Rotas |
|---------|-------|
| `src/backend/routes/adopters.js` | `GET/POST /register`, `GET /register/success` |
| `src/backend/routes/donations.js` | `GET/POST /donate`, `GET /donate/receipt/:code`, upload comprovante, admin |
| `src/backend/routes/settings.js` | `GET/POST /admin/settings` |
| `src/backend/routes/volunteers.js` | `GET/POST /volunteer`, `GET /admin/volunteers`, status update |
| `src/backend/routes/visits.js` | `GET /admin/visits`, `GET /admin/visits/new`, `POST /admin/visits`, status update |

### Backend — Utils
| Arquivo | Descrição |
|---------|-----------|
| `src/backend/utils/cpf.js` | Validação completa de CPF (formato + dígitos verificadores) |

### Frontend — Views
| Arquivo | Descrição |
|---------|-----------|
| `src/frontend/views/register/form.ejs` | Formulário de cadastro de adotante |
| `src/frontend/views/register/success.ejs` | Confirmação de cadastro |
| `src/frontend/views/donations/form.ejs` | Formulário de doação (PIX com chave visível + upload) |
| `src/frontend/views/donations/receipt.ejs` | Comprovante de doação (status dinâmico, upload posterior) |
| `src/frontend/views/volunteer/form.ejs` | Formulário de inscrição como voluntário |
| `src/frontend/views/volunteer/success.ejs` | Confirmação de inscrição |
| `src/frontend/views/admin/donations.ejs` | Painel admin de doações (confirmar/rejeitar PIX) |
| `src/frontend/views/admin/settings.ejs` | Configurações do sistema (chave PIX, e-mail) |
| `src/frontend/views/admin/volunteers.ejs` | Painel admin de voluntários (aprovar/rejeitar) |
| `src/frontend/views/admin/visits.ejs` | Lista de visitas agendadas |
| `src/frontend/views/admin/visit-form.ejs` | Formulário de agendamento de visita |

---

## 🗂️ Arquivos Modificados

| Arquivo | O que mudou |
|---------|-------------|
| `src/backend/config/seed.sql` | Novas tabelas: `adopters`, `donations` (+ `receipt_image`), `volunteers`, `visits`, `settings` |
| `src/backend/server.js` | Registro de 5 novas rotas: adopters, donations, volunteers, visits, settings |
| `src/frontend/public/css/style.css` | ~670 linhas de CSS para todas as novas seções e componentes |
| `src/frontend/views/layout-header.ejs` | Links: Doe Agora, Voluntarie-se (público); Doações, Voluntários, Visitas, ⚙️ (admin) |
| `src/frontend/views/layout-footer.ejs` | Links: Cadastre-se, Doe Agora, Voluntarie-se |

---

## 🗃️ Banco de Dados — Novas Tabelas

### `adopters` — Cadastro de adotantes (US11)
```sql
id, name, cpf (UNIQUE), phone, email (UNIQUE), address, created_at
```

### `donations` — Doações financeiras (US13)
```sql
id, amount, payment_method, donor_name, donor_email, status, receipt_code (UNIQUE), receipt_image, created_at
```
**Status possíveis:** `completed`, `pending_payment`, `pending_review`, `rejected`

### `volunteers` — Voluntários (US14/US16)
```sql
id, name, email (UNIQUE), phone, availability, motivation, status, reviewed_by (FK users), reviewed_at, created_at
```
**Status possíveis:** `pending`, `approved`, `rejected`

### `visits` — Agendamentos de visita (US15)
```sql
id, adoption_id (FK adoptions), visit_date, visit_time, visit_type, notes, status, scheduled_by (FK users), created_at
```
**Status possíveis:** `scheduled`, `completed`, `cancelled`

### `settings` — Configurações do sistema
```sql
key (PK), value, updated_at
```
**Chaves:** `pix_key`, `project_email`

---

## 🗺️ Mapa Completo de Rotas

### Rotas Públicas (sem autenticação)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Página inicial |
| GET | `/pets` | Listagem de pets com filtros |
| GET | `/pets/:id` | Detalhe do pet + formulário adoção |
| POST | `/adoptions` | Enviar solicitação de adoção |
| GET | `/login` | Tela de login |
| POST | `/login` | Autenticar |
| GET | `/logout` | Encerrar sessão |
| GET | `/register` | Formulário de cadastro adotante |
| POST | `/register` | Processar cadastro |
| GET | `/register/success` | Confirmação de cadastro |
| GET | `/donate` | Formulário de doação |
| POST | `/donate` | Processar doação (com upload) |
| GET | `/donate/receipt/:code` | Comprovante de doação |
| POST | `/donate/receipt/:code/upload` | Upload posterior de comprovante PIX |
| GET | `/volunteer` | Formulário de inscrição voluntário |
| POST | `/volunteer` | Processar inscrição |
| GET | `/volunteer/success` | Confirmação de inscrição |

### Rotas Admin (requer login ONG)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/pets` | Dashboard de pets |
| GET | `/admin/pets/new` | Cadastrar pet |
| POST | `/admin/pets` | Salvar novo pet |
| GET | `/admin/pets/:id/edit` | Editar pet |
| POST | `/admin/pets/:id` | Atualizar pet |
| POST | `/admin/pets/:id/delete` | Remover pet |
| GET | `/admin/adoptions` | Dashboard de adoções |
| POST | `/admin/adoptions/:id/status` | Aprovar/rejeitar adoção |
| GET | `/admin/donations` | Dashboard de doações |
| POST | `/admin/donations/:id/status` | Confirmar/rejeitar doação PIX |
| GET | `/admin/volunteers` | Dashboard de voluntários |
| POST | `/admin/volunteers/:id/status` | Aprovar/rejeitar voluntário |
| GET | `/admin/visits` | Lista de visitas agendadas |
| GET | `/admin/visits/new` | Formulário de agendamento |
| POST | `/admin/visits` | Criar agendamento |
| POST | `/admin/visits/:id/status` | Atualizar status da visita |
| GET | `/admin/settings` | Configurações do sistema |
| POST | `/admin/settings` | Salvar configurações |

---

## 🧪 Roteiro de Testes

### Pré-requisitos

```bash
# 1. Banco rodando
docker compose up -d

# 2. Se for a primeira vez após as mudanças, rodar o SQL manualmente:
docker exec adotapet-db psql -U adotapet -d adotapet -f /docker-entrypoint-initdb.d/01-seed.sql

# 3. Instalar dependências e subir
npm install
npm run dev
```

> Acesse http://localhost:3000

---

### ✅ US02 — Login de Usuário (ONG)

1. Ir para `/login`
2. **Credenciais erradas:** digitar `wrong@test.com` / `senhaerrada` → deve exibir flash "E-mail ou senha inválidos"
3. **Credenciais corretas:** digitar `admin@lovep.com` / `admin123` → redireciona para `/admin/pets`
4. Verificar navbar mostra links admin: Gerenciar Pets, Adoções, Doações, Voluntários, Visitas, ⚙️
5. Clicar "Sair" → volta para home, links admin somem

---

### ✅ US11 — Cadastro de Adotante

1. Ir para `/register`
2. **CPF inválido:** preencher com CPF `111.111.111-11` → flash "CPF inválido"
3. **Dados válidos:** preencher:
   - Nome: `Maria Silva`
   - CPF: `529.982.247-25`
   - Telefone: `(82) 99888-7777`
   - E-mail: `maria@teste.com`
   - Endereço: `Rua das Flores, 123`
4. Submeter → redireciona para `/register/success`
5. **CPF duplicado:** tentar cadastrar novamente com mesmo CPF → flash "CPF já cadastrado"
6. **E-mail duplicado:** tentar com mesmo e-mail → flash "E-mail já cadastrado"

**Verificar no banco:**
```sql
docker exec adotapet-db psql -U adotapet -d adotapet -c "SELECT * FROM adopters;"
```

---

### ✅ US13 — Doação Financeira

#### Configurar PIX (admin):
1. Login como admin → ir para `/admin/settings`
2. Cadastrar chave PIX: `pix@lovepatinhas.org`
3. Cadastrar e-mail: `contato@lovepatinhas.org`
4. Salvar → flash "Configurações salvas"

#### Doação via PIX:
1. Ir para `/donate`
2. Selecionar valor R$ 50 (botão sugerido)
3. Selecionar PIX → deve aparecer caixa com chave `pix@lovepatinhas.org` + botão Copiar + campo upload comprovante
4. Preencher nome e e-mail (opcional)
5. Submeter **sem comprovante** → status `pending_payment`, receipt mostra campo de upload
6. Na tela de receipt, fazer upload do comprovante → status muda para `pending_review`

#### Doação via Cartão/Boleto:
1. Selecionar Cartão ou Boleto → seção PIX some
2. Submeter → status `completed` direto (simulado)

#### Admin — Confirmar doação PIX:
1. Login admin → `/admin/donations`
2. Doação PIX com comprovante aparece com status "Pendente" e botões Confirmar/Rejeitar
3. Clicar "Confirmar" → status muda para "Confirmado"

**Verificar no banco:**
```sql
docker exec adotapet-db psql -U adotapet -d adotapet -c "SELECT id, amount, payment_method, status, receipt_image FROM donations;"
```

---

### ✅ US14 — Cadastro de Voluntário

1. Ir para `/volunteer`
2. Preencher:
   - Nome: `Carlos Voluntário`
   - Telefone: `(82) 98888-1234`
   - E-mail: `carlos@teste.com`
   - Disponibilidade: `Sábados pela manhã, domingos à tarde`
   - Motivação: `Amo animais e quero ajudar`
3. Submeter → redireciona para `/volunteer/success`
4. **E-mail duplicado:** submeter novamente com mesmo e-mail → flash "Este e-mail já possui uma inscrição"

**Verificar no banco:**
```sql
docker exec adotapet-db psql -U adotapet -d adotapet -c "SELECT * FROM volunteers;"
```

---

### ✅ US16 — Aprovação de Voluntário

1. Login admin → ir para `/admin/volunteers`
2. Verificar contadores no topo: Total, Pendentes, Aprovados, Rejeitados
3. Verificar filtro por status (dropdown)
4. Clicar "Aprovar" no voluntário → confirmar dialog → status muda para "✅ Aprovado"
5. Verificar que mostra "por Admin ONG" e data da aprovação
6. Testar "Rejeitar" → status muda para "❌ Rejeitado"
7. Testar "Voltar p/ Pendente" → volta para "⏳ Pendente"

**Verificar no banco (deve ter `reviewed_by` e `reviewed_at`):**
```sql
docker exec adotapet-db psql -U adotapet -d adotapet -c "SELECT id, name, status, reviewed_by, reviewed_at FROM volunteers;"
```

---

### ✅ US15 — Agendamento de Visita

#### Pré-requisito: ter pelo menos 1 adoção pendente ou aprovada
```bash
# Se não tiver, solicite adoção de um pet pelo site (página de detalhe do pet)
```

1. Login admin → ir para `/admin/visits`
2. Clicar "+ Agendar Visita"
3. Selecionar adoção no dropdown (mostra "Adotante → Pet")
4. Definir data futura e horário
5. Selecionar tipo: Visita Domiciliar ou Entrevista
6. Preencher observações (opcional)
7. Submeter → flash "Visita agendada com sucesso!" → aparece na tabela
8. **Data passada:** tentar agendar com data no passado → flash "Data deve ser futura"
9. Na tabela, testar ações:
   - "Concluída" → status muda para "✅ Concluída"
   - "Cancelar" → status muda para "❌ Cancelada"
   - "Reagendar" → volta para "📅 Agendada"

**Verificar no banco:**
```sql
docker exec adotapet-db psql -U adotapet -d adotapet -c "
SELECT v.id, a.adopter_name, p.name AS pet, v.visit_date, v.visit_time, v.visit_type, v.status
FROM visits v
JOIN adoptions a ON a.id = v.adoption_id
JOIN pets p ON p.id = a.pet_id;
"
```

---

## 🔐 Credenciais de Teste

| Tipo | Dado |
|------|------|
| **Admin** | `admin@lovep.com` / `admin123` |
| **Banco** | host: `localhost`, porta: `5433`, user: `adotapet`, pass: `adotapet123`, db: `adotapet` |

---

## ⚠️ Observações

1. **Pagamento PIX:** O pagamento via PIX é **manual**. O doador vê a chave, faz a transferência no app do banco, e envia o comprovante pela plataforma. A ONG confirma manualmente no painel admin.
2. **Cartão e Boleto:** Ainda são **simulados** — o sistema registra a doação com status `completed` direto. Integração com gateway de pagamento fica para sprint futura.
3. **Notificações:** Não há envio de e-mail. As "notificações" são visuais (flash messages + status no sistema). Integração com nodemailer fica para sprint futura.
4. **Upload de imagens:** Comprovantes e fotos de pets são salvos em `src/frontend/public/uploads/`. O diretório precisa existir (já está no `.gitignore`).
