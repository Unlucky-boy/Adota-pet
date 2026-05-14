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
  image_data BYTEA,
  image_mime_type VARCHAR(50),
  vaccinated BOOLEAN DEFAULT FALSE,
  neutered BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
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
INSERT INTO pets (name, species, breed, age_months, size, gender, description, vaccinated, neutered, status) VALUES
  ('Thor', 'dog', 'Vira-lata', 24, 'large', 'male',
   'Thor é um cachorro muito dócil e brincalhão. Adora crianças e se dá bem com outros animais. Está vacinado e castrado, pronto para um lar cheio de amor!',
   TRUE, TRUE, 'available'),

  ('Luna', 'cat', 'Siamês', 12, 'small', 'female',
   'Luna é uma gatinha independente mas muito carinhosa. Gosta de ficar no colo e ronrona alto. Ideal para apartamento.',
   TRUE, TRUE, 'available'),

  ('Bob', 'dog', 'Labrador', 6, 'large', 'male',
   'Bob é um filhote cheio de energia! Precisa de espaço para correr e brincar. Muito inteligente e aprende rápido.',
   TRUE, FALSE, 'available'),

  ('Mel', 'cat', 'Persa', 36, 'medium', 'female',
   'Mel é uma gata calma e elegante. Perfeita para pessoas que buscam uma companhia tranquila. Muito bem cuidada.',
   TRUE, TRUE, 'available'),

  ('Rex', 'dog', 'Pastor Alemão', 18, 'large', 'male',
   'Rex é um cão leal e protetor. Foi resgatado de situação de maus-tratos e agora busca um lar definitivo.',
   TRUE, TRUE, 'available'),

  ('Mia', 'cat', 'Vira-lata', 8, 'small', 'female',
   'Mia é uma gatinha muito brincalhona e ativa. Adora brinquedos e é ótima com crianças.',
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
  receipt_image   TEXT,
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
