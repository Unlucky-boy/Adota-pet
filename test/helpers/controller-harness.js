/**
 * Harness compartilhado dos testes unitários de controller.
 *
 * Os controllers recebem `req`/`res` do Express e falam direto com o
 * singleton `config/db`. Este helper fornece dublês para os três:
 * requisições e respostas falsas, e um stub de `db` que registra as
 * consultas e devolve resultados enfileirados.
 *
 * Regras de asserção (ver CONTRIBUTING.md → Testes Automatizados):
 *   - afirme params, flash messages, redirects e o que foi renderizado;
 *   - use `stub.matching('INSERT INTO ...')` em vez de contar chamadas;
 *   - `stub.calls.length === 0` só quando "não tocou no banco" for o ponto;
 *   - nunca escreva regex sobre o SQL cru — isso é trabalho da camada de
 *     integração, que exercita o banco de verdade.
 */

const db = require('../../src/backend/config/db');

const original = { query: db.query, transaction: db.transaction };

/**
 * Cria uma requisição falsa com os campos que os controllers acessam.
 */
function createRequest({ body = {}, params = {}, query = {}, session = {}, file } = {}) {
  return { body, params, query, session, file };
}

/**
 * Cria uma resposta falsa que captura redirect/render/status/send.
 */
function createResponse() {
  return {
    redirectPath: null,
    rendered: null,
    statusCode: 200,
    body: null,
    headers: {},
    redirect(path) {
      this.redirectPath = path;
      return this;
    },
    render(view, data) {
      this.rendered = { view, data };
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set(field, value) {
      this.headers[String(field).toLowerCase()] = value;
      return this;
    },
  };
}

/**
 * Colapsa espaços em branco do SQL para que as asserções sobrevivam a
 * reindentação da query.
 */
function normalize(sql) {
  return String(sql).replace(/\s+/g, ' ').trim();
}

/**
 * Substitui `db.query` e `db.transaction` por dublês. Sempre chame
 * `restore()` num `afterEach`, senão o singleton fica corrompido para os
 * demais testes do mesmo processo.
 */
function stubDb() {
  const calls = [];
  const queue = [];
  let transactionFailure = null;

  function respond(text, params) {
    calls.push({ text: normalize(text), params });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next || { rows: [], rowCount: 0 };
  }

  const stub = {
    calls,

    /** Enfileira resultados, consumidos na ordem das consultas. */
    queueResults(...results) {
      queue.push(...results);
      return stub;
    },

    /** Faz a próxima consulta da fila lançar um erro. */
    failNextQuery(error = new Error('db failure')) {
      queue.push(error);
      return stub;
    },

    /** Faz `db.transaction` falhar antes de executar o callback. */
    failTransaction(error = new Error('transaction failure')) {
      transactionFailure = error;
      return stub;
    },

    /** Consultas cujo SQL contém o trecho informado. */
    matching(fragment) {
      return calls.filter((call) => call.text.includes(normalize(fragment)));
    },

    /** Params da n-ésima consulta registrada. */
    paramsOf(index) {
      return calls[index].params;
    },

    restore() {
      db.query = original.query;
      db.transaction = original.transaction;
    },
  };

  db.query = async (text, params) => respond(text, params);
  db.transaction = async (callback) => {
    if (transactionFailure) throw transactionFailure;
    return callback({ query: async (text, params) => respond(text, params) });
  };

  return stub;
}

module.exports = { createRequest, createResponse, stubDb, normalize };
