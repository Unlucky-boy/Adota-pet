const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  isValidPhone,
  isValidEmail,
  isValidDate,
  isValidId,
  parseStrictAmount,
} = require('../../src/backend/utils/validation');

describe('input validation', () => {
  test('accepts formatted Brazilian phone numbers', () => {
    assert.equal(isValidPhone('(11) 99999-9999'), true);
    assert.equal(isValidPhone('1133334444'), true);
  });

  test('rejects text, repeated digits and invalid phone lengths', () => {
    assert.equal(isValidPhone('telefone'), false);
    assert.equal(isValidPhone('abc11999999999'), false);
    assert.equal(isValidPhone('11111111111'), false);
    assert.equal(isValidPhone('12345'), false);
  });

  test('validates e-mail and date formats', () => {
    assert.equal(isValidEmail('ana@example.com'), true);
    assert.equal(isValidEmail('ana.example.com'), false);
    assert.equal(isValidDate('2026-09-21'), true);
    assert.equal(isValidDate('2026-02-30'), false);
  });

  test('accepts only strict numeric IDs and monetary values', () => {
    assert.equal(isValidId('12'), true);
    assert.equal(isValidId('12abc'), false);
    assert.equal(parseStrictAmount('100.50'), 100.5);
    assert.equal(parseStrictAmount('100abc'), null);
  });
});