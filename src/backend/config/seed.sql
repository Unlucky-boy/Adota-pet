-- =============================================
-- Adota Pet — Seed inicial do banco de dados
-- Executado automaticamente pelo docker-compose
-- =============================================

-- Tabela de usuários (membros da ONG)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de animais
CREATE TABLE IF NOT EXISTS pets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  species VARCHAR(50) NOT NULL,
  breed VARCHAR(100),
  age_months INTEGER,
  size VARCHAR(20),
  gender VARCHAR(10),
  description TEXT,
  image_url TEXT,
  vaccinated BOOLEAN DEFAULT FALSE,
  neutered BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pets_seed_identity
  ON pets (
    name,
    species,
    COALESCE(breed, ''),
    COALESCE(age_months, -1),
    COALESCE(size, ''),
    COALESCE(gender, '')
  );

-- Tabela de solicitações de adoção
CREATE TABLE IF NOT EXISTS adoptions (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  adopter_name VARCHAR(100) NOT NULL,
  adopter_email VARCHAR(150) NOT NULL,
  adopter_phone VARCHAR(20),
  adopter_address TEXT,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- Dados iniciais
-- =============================================

-- Usuário admin padrão (senha: admin123)
-- Hash bcrypt de 'admin123' com 10 rounds
INSERT INTO users (name, email, password_hash) VALUES
  ('Admin ONG', 'admin@lovep.com', '$2b$10$Lxpq/vmhED9yGrhEh2gfguFKMdh599D/EldRG9rvEmmR9e2xT.mWy')
ON CONFLICT (email) DO NOTHING;

-- Pets de exemplo
INSERT INTO pets (name, species, breed, age_months, size, gender, description, image_url, vaccinated, neutered, status) VALUES
  ('Thor', 'dog', 'Vira-lata', 24, 'large', 'male',
   'Thor é um cachorro muito dócil e brincalhão. Adora crianças e se dá bem com outros animais. Está vacinado e castrado, pronto para um lar cheio de amor!',
   'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800',
   TRUE, TRUE, 'available'),

  ('Luna', 'cat', 'Siamês', 12, 'small', 'female',
   'Luna é uma gatinha independente mas muito carinhosa. Gosta de ficar no colo e ronrona alto. Ideal para apartamento.',
   'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?auto=format&fit=crop&q=80&w=800',
   TRUE, TRUE, 'available'),

  ('Bob', 'dog', 'Labrador', 6, 'large', 'male',
   'Bob é um filhote cheio de energia! Precisa de espaço para correr e brincar. Muito inteligente e aprende rápido.',
   'https://images.metroimg.com/2020/03/05102915/lad.jpg',
   TRUE, FALSE, 'available'),

  ('Mel', 'cat', 'Persa', 36, 'medium', 'female',
   'Mel é uma gata calma e elegante. Perfeita para pessoas que buscam uma companhia tranquila. Muito bem cuidada.',
   'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=800',
   TRUE, TRUE, 'available'),

  ('Rex', 'dog', 'Pastor Alemão', 18, 'large', 'male',
   'Rex é um cão leal e protetor. Foi resgatado de situação de maus-tratos e agora busca um lar definitivo.',
   'https://midias.correio24horas.com.br/2024/02/28/edicaseo-pastor-alemao-e-um-otimo-companheiro-para-diversas-atividades-imagem-anna-titova--shutterstock-rb5hiu.jpg',
   TRUE, TRUE, 'available'),

  ('Mia', 'cat', 'Vira-lata', 8, 'small', 'female',
   'Mia é uma gatinha muito brincalhona e ativa. Adora brinquedos e é ótima com crianças.',
   'https://images.unsplash.com/photo-1548247416-ec66f4900b2e?auto=format&fit=crop&q=80&w=800',
   FALSE, FALSE, 'available')
ON CONFLICT DO NOTHING;

-- Tabela de adotantes (US11 — Cadastro de Adotante)
CREATE TABLE IF NOT EXISTS adopters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  cpf         VARCHAR(14)  UNIQUE NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  address     TEXT         NOT NULL,
  password_hash TEXT       NOT NULL,
  created_at  TIMESTAMP    DEFAULT NOW()
);

-- Tabela de doações financeiras (US13 — Doação)
CREATE TABLE IF NOT EXISTS donations (
  id              SERIAL PRIMARY KEY,
  amount          NUMERIC(10,2) NOT NULL,
  payment_method  VARCHAR(20)   NOT NULL,
  donor_name      VARCHAR(100),
  donor_email     VARCHAR(150),
  status          VARCHAR(20)   DEFAULT 'completed',
  receipt_code    VARCHAR(50)   UNIQUE NOT NULL,
  receipt_image   BYTEA,
  receipt_image_mime_type VARCHAR(50),
  created_at      TIMESTAMP     DEFAULT NOW()
);

-- Tabela de voluntários (US14 / US16)
CREATE TABLE IF NOT EXISTS volunteers (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  email          VARCHAR(150) UNIQUE NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  availability   TEXT         NOT NULL,
  motivation     TEXT,
  status         VARCHAR(20)  DEFAULT 'pending',
  reviewed_by    INTEGER      REFERENCES users(id),
  reviewed_at    TIMESTAMP,
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- Tabela de agendamentos de visita (US15)
CREATE TABLE IF NOT EXISTS visits (
  id             SERIAL PRIMARY KEY,
  adoption_id    INTEGER      REFERENCES adoptions(id) ON DELETE CASCADE,
  visit_date     DATE         NOT NULL,
  visit_time     TIME         NOT NULL,
  visit_type     VARCHAR(30)  DEFAULT 'home_visit',
  notes          TEXT,
  status         VARCHAR(20)  DEFAULT 'scheduled',
  scheduled_by   INTEGER      REFERENCES users(id),
  created_at     TIMESTAMP    DEFAULT NOW()
);

-- Configurações do sistema (chave PIX, e-mail do projeto)
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(50) PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('pix_key', ''),
  ('project_email', '')
ON CONFLICT (key) DO NOTHING;

-- Histórico, checklist e confirmação da entrega de adoções
CREATE TABLE IF NOT EXISTS adoption_status_history (
  id SERIAL PRIMARY KEY,
  adoption_id INTEGER NOT NULL REFERENCES adoptions(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  note TEXT,
  changed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adoption_checklists (
  id SERIAL PRIMARY KEY,
  adoption_id INTEGER NOT NULL REFERENCES adoptions(id) ON DELETE CASCADE,
  item_key VARCHAR(50) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,
  UNIQUE (adoption_id, item_key)
);

CREATE TABLE IF NOT EXISTS adoption_deliveries (
  id SERIAL PRIMARY KEY,
  adoption_id INTEGER UNIQUE NOT NULL REFERENCES adoptions(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  signed_by VARCHAR(100) NOT NULL,
  document_reference VARCHAR(150),
  notes TEXT,
  confirmed_by INTEGER REFERENCES users(id)
);

-- Saúde e operação dos pets
CREATE TABLE IF NOT EXISTS pet_health_records (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  record_type VARCHAR(50) NOT NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  provider VARCHAR(120),
  description TEXT NOT NULL,
  cost NUMERIC(10,2) DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_vaccinations (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  vaccine_name VARCHAR(100) NOT NULL,
  administered_at DATE NOT NULL,
  next_due_at DATE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL DEFAULT 'unidade',
  minimum_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foster_homes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  address TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS foster_assignments (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  foster_home_id INTEGER NOT NULL REFERENCES foster_homes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volunteer_shifts (
  id SERIAL PRIMARY KEY,
  volunteer_id INTEGER REFERENCES volunteers(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  assigned_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor VARCHAR(120),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_history_adoption ON adoption_status_history(adoption_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pet_health_pet ON pet_health_records(pet_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_vaccinations_due ON pet_vaccinations(next_due_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
