# Modelo de Entidades e Relacionamentos (ER)

Abaixo está o diagrama de Entidades e Relacionamentos do banco de dados do projeto **Adota Pet**, baseado no arquivo de configuração do banco (`src/backend/config/seed.sql`).

```mermaid
erDiagram
    users ||--o{ volunteers : "revisa"
    users ||--o{ visits : "agenda"
    
    pets ||--o{ adoptions : "possui"
    
    adoptions ||--o{ visits : "possui"
    
    users {
        int id PK
        varchar(100) name
        varchar(150) email
        text password_hash
        timestamp created_at
    }

    pets {
        int id PK
        varchar(100) name
        varchar(50) species
        varchar(100) breed
        int age_months
        varchar(20) size
        varchar(10) gender
        text description
        bytea image_data
        varchar(50) image_mime_type
        boolean vaccinated
        boolean neutered
        varchar(20) status
        timestamp created_at
    }

    adoptions {
        int id PK
        int pet_id FK "REFERENCES pets(id)"
        varchar(100) adopter_name
        varchar(150) adopter_email
        varchar(20) adopter_phone
        text adopter_address
        text message
        varchar(20) status
        timestamp created_at
    }

    adopters {
        int id PK
        varchar(100) name
        varchar(14) cpf
        varchar(20) phone
        varchar(150) email
        text address
        text password_hash
        timestamp created_at
    }

    donations {
        int id PK
        numeric(10_2) amount
        varchar(20) payment_method
        varchar(100) donor_name
        varchar(150) donor_email
        varchar(20) status
        varchar(50) receipt_code
        bytea receipt_image
        varchar(50) receipt_image_mime_type
        timestamp created_at
    }

    volunteers {
        int id PK
        varchar(100) name
        varchar(150) email
        varchar(20) phone
        text availability
        text motivation
        varchar(20) status
        int reviewed_by FK "REFERENCES users(id)"
        timestamp reviewed_at
        timestamp created_at
    }

    visits {
        int id PK
        int adoption_id FK "REFERENCES adoptions(id)"
        date visit_date
        time visit_time
        varchar(30) visit_type
        text notes
        varchar(20) status
        int scheduled_by FK "REFERENCES users(id)"
        timestamp created_at
    }

    settings {
        varchar(50) key PK
        text value
        timestamp updated_at
    }
```

## Relacionamentos Principais

1. **`pets` e `adoptions`** (1 para N):
   - Um pet pode ter várias solicitações de adoção (ao longo do tempo ou simultâneas, caso em aberto). 
   - A tabela `adoptions` guarda a chave estrangeira `pet_id`.
   - *Atenção:* Os dados do adotante estão diretamente na tabela `adoptions` e não vinculados à tabela `adopters` por uma chave estrangeira no modelo atual.

2. **`adoptions` e `visits`** (1 para N):
   - Uma solicitação de adoção pode ter várias visitas agendadas.
   - A tabela `visits` guarda a chave estrangeira `adoption_id`.

3. **`users` e `visits`** (1 para N):
   - Um usuário (admin/membro da ONG) pode agendar e ser responsável por várias visitas.
   - A tabela `visits` guarda a chave estrangeira `scheduled_by`.

4. **`users` e `volunteers`** (1 para N):
   - Um usuário (admin/membro da ONG) revisa os cadastros de voluntários.
   - A tabela `volunteers` guarda a chave estrangeira `reviewed_by`.

## Tabelas Independentes
- **`adopters`**: Guarda dados de usuários cadastrados para adoção.
- **`donations`**: Registro de doações, independentes de outras tabelas.
- **`settings`**: Tabela de chave-valor simples para guardar configurações do sistema (ex: chave PIX, e-mail do projeto).
