const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { validateCpf, stripCpf, formatCpf } = require('../../src/backend/utils/cpf');

describe('cpf validation', () => {
  test('accepts a valid cpf with punctuation', () => {
    assert.equal(validateCpf('529.982.247-25'), true);
  });

  test('accepts a valid cpf without punctuation', () => {
    assert.equal(validateCpf('52998224725'), true);
  });

  test('rejects a cpf with the wrong length', () => {
    assert.equal(validateCpf('5299822472'), false);
    assert.equal(validateCpf('529982247255'), false);
  });

  test('rejects a cpf made of repeated digits', () => {
    assert.equal(validateCpf('111.111.111-11'), false);
    assert.equal(validateCpf('00000000000'), false);
  });

  test('rejects a cpf with a wrong first check digit', () => {
    assert.equal(validateCpf('52998224735'), false);
  });

  test('rejects a cpf with a wrong second check digit', () => {
    assert.equal(validateCpf('52998224726'), false);
  });

  test('strips every non digit character', () => {
    assert.equal(stripCpf('529.982.247-25'), '52998224725');
  });

  test('formats a stripped cpf into the standard mask', () => {
    assert.equal(formatCpf('52998224725'), '529.982.247-25');
  });

  test('keeps an already formatted cpf unchanged', () => {
    assert.equal(formatCpf('529.982.247-25'), '529.982.247-25');
  });
});
