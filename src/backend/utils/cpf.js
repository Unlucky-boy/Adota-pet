/**
 * Validação de CPF brasileiro.
 * Verifica formato e dígitos verificadores.
 */

/**
 * Remove caracteres não numéricos do CPF.
 * @param {string} cpf
 * @returns {string}
 */
function stripCpf(cpf) {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida CPF (formato + dígitos verificadores).
 * Aceita tanto "12345678900" quanto "123.456.789-00".
 * @param {string} cpf
 * @returns {boolean}
 */
function validateCpf(cpf) {
  const stripped = stripCpf(cpf);

  if (stripped.length !== 11) return false;

  // Rejeitar sequências repetidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(stripped)) return false;

  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(stripped[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(stripped[9], 10)) return false;

  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(stripped[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(stripped[10], 10)) return false;

  return true;
}

/**
 * Formata CPF para o padrão 000.000.000-00.
 * @param {string} cpf
 * @returns {string}
 */
function formatCpf(cpf) {
  const stripped = stripCpf(cpf);
  return stripped.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

module.exports = { validateCpf, stripCpf, formatCpf };
