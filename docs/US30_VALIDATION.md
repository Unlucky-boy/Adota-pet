# US30 — Roteiro de validação interna do MVP

## Objetivo e escopo

Validar com dados controlados o Dashboard Analítico (`/admin/dashboard`) e a
Auditoria administrativa (`/admin/operations`) antes da sessão com a ONG.
O roteiro combina conferência manual da interface com a suíte automatizada
`test/integration/mvp-validation.test.js`.

## Participantes e ambiente

- Participantes: equipe ACE7.
- Perfil necessário: usuário administrativo da ONG.
- Ambiente recomendado: banco de testes isolado (`adotapet_test`).
- Data de referência desta execução: 18/10/2026.
- Formato: validação interna híbrida — integração HTTP + consultas SQL + inspeção das páginas.

## Preparação

```bash
npm run db:test:up
npm run test:us30
npm run db:test:down
```

A suíte recria os dados antes de cada cenário. Nunca aponte `DB_NAME` para um
banco de produção: a infraestrutura bloqueia a limpeza quando o nome não
termina em `_test`.

## Cenário 1 — Dashboard e métricas

1. Criar adoções pendente, aprovada e fora do período.
2. Criar visitas agendada, concluída e fora do período.
3. Criar doações confirmada, pendente e fora do período.
4. Abrir `/admin/dashboard?start_date=2025-01-01&end_date=2025-01-31`.
5. Conferir os cartões contra as consultas abaixo.

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status IN ('approved', 'completed')) AS approved
FROM adoptions
WHERE created_at >= DATE '2025-01-01'
  AND created_at < DATE '2025-01-31' + INTERVAL '1 day';

SELECT
  COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed
FROM visits
WHERE visit_date BETWEEN DATE '2025-01-01' AND DATE '2025-01-31';

SELECT
  COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS confirmed,
  COUNT(*) FILTER (WHERE status IN ('pending_payment', 'pending_review')) AS pending
FROM donations
WHERE created_at >= DATE '2025-01-01'
  AND created_at < DATE '2025-01-31' + INTERVAL '1 day';
```

Resultado esperado: cartões e textos auxiliares iguais ao banco; registros de
fevereiro não aparecem. Um período invertido deve mostrar a mensagem de datas
inválidas e nunca executar SQL com datas inconsistentes.

## Cenário 2 — Filtros e CSV

Com o mesmo período, baixar:

- `/admin/reports/adoptions.csv`
- `/admin/reports/donations.csv`
- `/admin/reports/financial.csv`

Para cada relatório, conferir:

1. `Content-Type` CSV e nome do arquivo no download.
2. Cabeçalho legível em UTF-8.
3. Inclusão dos registros de janeiro.
4. Exclusão dos registros de fevereiro.
5. No financeiro, doações confirmadas, despesas e saldo líquido do mês.
6. Visitante sem login é redirecionado para `/login`.

## Cenário 3 — Cadastros da Operação

Executar em `/admin/operations`, nesta ordem:

| Cadastro | Dado de conferência | Resultado esperado |
|---|---|---|
| Registro veterinário | `Consulta US30` | Linha no histórico veterinário |
| Vacinação | `V10 US30` | Linha em próximos vencimentos |
| Estoque | `Ração US30`, 20 kg | Item e saldo na listagem |
| Lar temporário | `Lar US30`, capacidade 2 | Lar disponível no formulário |
| Acolhimento | `Pet Auditoria US30` → `Lar US30` | Acolhimento ativo na listagem |
| Turno | `Voluntário US30`, 08:00–12:00 | Turno na agenda |
| Despesa | `Despesa US30`, R$ 25,50 | Linha em despesas recentes |

Após cada envio, confirmar o redirecionamento, a mensagem de sucesso, a linha
na tabela de domínio e uma nova entrada em `audit_logs`.

## Cenário 4 — Trilha de auditoria

Na tabela “Auditoria administrativa”, conferir para cada ação:

- data e horário;
- responsável (`Admin Teste` no ambiente automatizado);
- ação e entidade;
- resumo da alteração, com valores relevantes;
- pet relacionado, quando aplicável.

Também criar uma visita e alterar seu status. As ações `visit_created` e
`visit_status_changed` devem mostrar adoção, data, horário e transição de
status. A consulta de evidência é:

```sql
SELECT a.created_at, u.name AS responsavel, a.action,
       a.entity_type, a.entity_id, a.metadata
FROM audit_logs a
LEFT JOIN users u ON u.id = a.user_id
ORDER BY a.id;
```

## Registro de problemas

Todo desvio deve ser incluído em `docs/US30_ISSUES.md` com identificador,
severidade, passos, resultado esperado, resultado obtido e decisão. Escala:

- **Crítica:** exposição/perda de dados ou módulo indisponível.
- **Alta:** critério de aceite não atendido sem contorno seguro.
- **Média:** resultado incorreto com contorno ou rastreabilidade incompleta.
- **Baixa:** problema visual ou textual sem impacto nos dados.

## Critério de saída

A validação está aprovada quando toda a suíte passa, métricas e CSVs coincidem
com o SQL, os sete cadastros aparecem nas listagens e cada ação possui registro
de auditoria com responsável, data e alteração. Não pode restar issue Crítica
ou Alta aberta.
