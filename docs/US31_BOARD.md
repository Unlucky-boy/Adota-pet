# US31 — Board de estabilização do MVP

Atualizado em: **18/10/2026**

| Tarefa | Situação | Severidade/prioridade | Evidência ou dependência |
|---|---|---|---|
| Consolidar bugs encontrados na US30 | Concluída | Alta | `US30_ISSUES.md` e `US31_ISSUES.md` |
| Corrigir detalhes ausentes na Auditoria | Concluída | Alta | US30-ISSUE-002; integração US30 aprovada |
| Auditar criação e transição de visitas | Concluída | Alta | US30-ISSUE-003; integração US30 aprovada |
| Impedir upload de comprovante em doação alheia | Concluída | Alta | US31-ISSUE-001; testes unitário e integrado |
| Evitar transição falsa no fluxo de adoção | Concluída | Média | US31-ISSUE-002; testes unitário e integrado |
| Restringir revisão administrativa de doação | Concluída | Média | US31-ISSUE-003; testes unitário, integrado e funcional |
| Executar testes funcionais dos fluxos principais | Concluída | Alta | 7/7 aprovados em `US31_FUNCTIONAL_TEST_REPORT.md` |
| Executar suíte automatizada final | Concluída | Alta | `npm test`: 147/147 aprovados |
| Publicar issues e vincular PR no GitHub | Aguardando conexão externa | Alta | Código, testes e textos estão prontos; falta somente publicar os links externos |

## Critério de saída

O código está estável e sem bug crítico, alto, médio ou baixo conhecido em
aberto. A entrega técnica local está concluída. A tarefa externa de publicação
permanece explicitamente visível no board até a conexão GitHub ser autorizada.

