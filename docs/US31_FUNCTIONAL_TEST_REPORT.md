# US31 — Relatório de testes funcionais

| Campo | Registro |
|---|---|
| Participantes | Equipe ACE7 |
| Data | 18/10/2026 |
| Formato | Testes funcionais HTTP ponta a ponta com consultas de evidência no PostgreSQL |
| Ambiente | Aplicação Express e banco isolado `adotapet_test` |
| Implementação | `test/integration/core-functional-flows.test.js` |
| Comando | `npm run test:functional` |
| Resultado | **7 aprovados, 0 falhas** |

## Resultados por funcionalidade

| Funcionalidade | Tipo | Resultado | Evidência automatizada |
|---|---|---|---|
| Login | Funcional positivo e negativo | Aprovado | Credencial incorreta retorna ao login; sessão ONG acessa `/admin/pets` |
| Cadastro de adotante | Funcional e persistência | Aprovado | Cadastro redireciona para sucesso, senha fica com hash, CPF duplicado não cria nova conta |
| Solicitação e aprovação de adoção | Funcional, integração e auditoria | Aprovado | Solicitação vinculada ao adotante; aprovação reserva o pet e gera `adoption_status_changed` |
| Doação | Funcional, upload e aprovação | Aprovado | PIX passa por `pending_payment`, `pending_review` e `completed`, mantendo vínculo com o adotante |
| Voluntariado | Funcional e autorização administrativa | Aprovado | Inscrição usa a identidade autenticada; aprovação registra responsável e data |
| Agendamento de visita | Funcional, listagem e persistência | Aprovado | Entrevista futura é persistida como `scheduled` e aparece na listagem administrativa |
| Perfil | Funcional e privacidade | Aprovado | Exibe cadastro, adoção, visita, doação e voluntariado do adotante autenticado |

## Testes de regressão associados às correções

| Fluxo | Bug reproduzido | Resultado após correção |
|---|---|---|
| Adoção | Reenvio do mesmo status criava histórico e auditoria falsos | Nenhum `UPDATE`, histórico ou auditoria é criado |
| Doação | Outra sessão anexava comprovante usando código alheio | Upload recusado; registro permanece `pending_payment` e inacessível ao visitante |
| Doação administrativa | Atualização podia ocorrer fora de `pending_review` | Endpoint valida estado, bloqueia o registro e audita a transição completa |

## Suíte final

Em 18/10/2026, `npm test` foi executado com o banco isolado ativo:

- **147 testes aprovados**
- **22 suítes aprovadas**
- **0 falhas, 0 cancelamentos, 0 testes ignorados**
- Duração registrada: aproximadamente **9,2 segundos**

Os logs de erro exibidos durante alguns testes unitários são intencionais: eles
pertencem aos cenários que simulam falhas de banco e validam o tratamento de erro.

