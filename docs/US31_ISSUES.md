# US31 — Registro de bugs e correções

Data da consolidação: **18/10/2026**  
Responsáveis: **Equipe ACE7**

## Bugs herdados da validação US30

| Issue | Severidade | Situação | Correção | Evidência |
|---|---|---|---|---|
| US30-ISSUE-001 — Período antigo ausente no relatório financeiro | Média | Resolvida | A grade mensal passou a respeitar o intervalo solicitado | `mvp-validation.test.js` — exportações CSV |
| US30-ISSUE-002 — Alteração invisível na Auditoria | Alta | Resolvida | Metadados detalhados e coluna “Alteração” adicionados | `mvp-validation.test.js` — cadastros e auditoria |
| US30-ISSUE-003 — Visitas sem trilha de auditoria | Alta | Resolvida | Criação e transição de visita agora são transacionais e auditadas | `mvp-validation.test.js` — `visit_created` e `visit_status_changed` |
| US30-ISSUE-004 — Custo veterinário decimal recusado | Média | Resolvida | Parâmetros opcionais recebem cast explícito para `date` e `numeric` | `mvp-validation.test.js` — custo `89.90` |

Os detalhes de reprodução originais permanecem em [`US30_ISSUES.md`](US30_ISSUES.md).

## Bugs encontrados no refinamento US31

### US31-ISSUE-001 — Visitante podia anexar comprovante em doação alheia

- Severidade: **Alta**
- Situação: **Resolvida**
- Módulo: `POST /donate/receipt/:code/upload`
- Passos para reproduzir: criar uma doação PIX em uma sessão; em outra sessão, enviar um arquivo usando o código da primeira doação.
- Resultado anterior: o comprovante era aceito, a doação mudava para `pending_review` e o código era vinculado à sessão invasora.
- Resultado esperado: apenas o doador, o adotante proprietário ou a ONG pode anexar o comprovante.
- Correção: consulta e atualização passaram a ocorrer na mesma transação com bloqueio do registro, validação de propriedade e validação do estado `pending_payment`.
- Teste de regressão: “prevents another visitor from attaching a receipt and claiming the donation”.

### US31-ISSUE-002 — Reenvio do mesmo status criava transição inexistente

- Severidade: **Média**
- Situação: **Resolvida**
- Módulo: `POST /admin/adoptions/:id/status`
- Passos para reproduzir: enviar `pending` para uma solicitação que já está `pending` ou reenviar `approved` para uma já aprovada.
- Resultado anterior: eram criadas novas linhas de histórico e auditoria sem alteração real.
- Resultado esperado: uma operação idempotente não deve registrar uma transição falsa.
- Correção: o fluxo retorna sem `UPDATE`, histórico ou auditoria quando o status atual é igual ao solicitado.
- Teste de regressão: “does not record a false transition when the adoption status is unchanged”.

### US31-ISSUE-003 — Situação de doação podia ser alterada fora da etapa de análise

- Severidade: **Média**
- Situação: **Resolvida**
- Módulo: `POST /admin/donations/:id/status`
- Passos para reproduzir: enviar diretamente uma atualização administrativa para uma doação `pending_payment`, concluída ou rejeitada.
- Resultado anterior: o endpoint aceitava qualquer registro existente e podia gerar auditoria sem a transição anterior.
- Resultado esperado: somente uma doação `pending_review` pode ser confirmada ou rejeitada.
- Correção: atualização transacional com bloqueio, validação do estado atual e auditoria contendo `oldStatus` e `newStatus`.
- Teste de regressão: cenários de confirmação PIX unitário, integrado e funcional.

## Rastreabilidade com PR

As issues de severidade alta são **US30-ISSUE-002**, **US30-ISSUE-003** e
**US31-ISSUE-001**. Todas as correções e seus testes estão no mesmo conjunto de
mudanças da US31. A publicação dos links externos de issue/PR depende da conexão
GitHub do ambiente; o vínculo previsto no PR é:

- `Closes US30-ISSUE-002`
- `Closes US30-ISSUE-003`
- `Closes US31-ISSUE-001`

Até a publicação externa, a rastreabilidade verificável está neste documento,
nos testes citados e no board da US31.

## Situação final

- Críticas abertas: **0**
- Altas abertas: **0**
- Médias abertas: **0**
- Baixas abertas: **0**

