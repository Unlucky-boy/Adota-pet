# US30 — Registro de problemas da validação interna

## US30-ISSUE-001 — Período antigo ausente no relatório financeiro

- Severidade: **Média**
- Status: **Resolvida**
- Módulo: `/admin/reports/financial.csv`
- Encontrado em: 18/10/2026
- Passos: exportar o relatório com início e fim anteriores aos 12 meses mais recentes.
- Resultado obtido: a grade de meses continuava fixa nos 12 meses atuais e o CSV não apresentava o período solicitado.
- Resultado esperado: a grade mensal deve ser gerada a partir do intervalo informado.
- Decisão: o intervalo da CTE `months` passou a usar as datas do filtro, mantendo 12 meses recentes somente quando não há período explícito.
- Evidência: cenário “valida filtros e conteúdo dos três relatórios CSV”.

## US30-ISSUE-002 — Alteração não era visível na Auditoria

- Severidade: **Alta**
- Status: **Resolvida**
- Módulo: `/admin/operations`
- Encontrado em: 18/10/2026
- Passos: cadastrar um registro operacional e consultar “Auditoria administrativa”.
- Resultado obtido: a tabela exibia data, usuário, ação e entidade, mas não os valores alterados.
- Resultado esperado: cada evento deve explicitar a alteração realizada.
- Decisão: adicionada a coluna “Alteração” e ampliados os metadados dos sete cadastros operacionais.
- Evidência: teste de integração verifica metadados e conteúdo renderizado.

## US30-ISSUE-003 — Visitas administrativas sem trilha de auditoria

- Severidade: **Alta**
- Status: **Resolvida**
- Módulo: `/admin/visits`
- Encontrado em: 18/10/2026
- Passos: agendar uma visita e alterar seu status.
- Resultado obtido: nenhuma entrada era criada em `audit_logs`.
- Resultado esperado: criação e mudança de status devem registrar responsável, data e transição.
- Decisão: criação e atualização passaram a ser transacionais e geram `visit_created` e `visit_status_changed`.
- Evidência: cenário de Auditoria valida ambas as ações e a transição `Agendado → Concluído`.

## US30-ISSUE-004 — Custo veterinário com centavos era recusado

- Severidade: **Média**
- Status: **Resolvida**
- Módulo: cadastro de registro veterinário em `/admin/operations`
- Encontrado em: 18/10/2026
- Passos: cadastrar um registro veterinário com custo `89.90`.
- Resultado obtido: o banco inferia o parâmetro de `COALESCE` como inteiro e devolvia erro de sintaxe numérica.
- Resultado esperado: valores monetários positivos com duas casas decimais devem ser persistidos.
- Decisão: os parâmetros opcionais de data e custo agora possuem cast explícito para `date` e `numeric`.
- Evidência: o roteiro automatizado cadastra e confere o custo decimal no banco e na listagem.

## Situação para saída

- Issues Críticas abertas: **0**
- Issues Altas abertas: **0**
- Issues Médias abertas: **0**
- Issues Baixas abertas: **0**
