function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidPhone(value) {
  if (typeof value !== 'string' || /[^\d\s()+.-]/.test(value)) return false;
  const digits = digitsOnly(value);
  return /^(\d)\1+$/.test(digits) === false && /^(?:\d{10}|\d{11})$/.test(digits);
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidId(value) {
  return /^\d+$/.test(String(value || '')) && Number(value) > 0;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function isValidPositiveInteger(value) {
  return /^\d+$/.test(String(value || '')) && Number(value) > 0;
}

function parseStrictAmount(value, allowZero = false) {
  const normalized = String(value || '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) return null;
  return amount;
}

function isValidHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  digitsOnly,
  isValidPhone,
  isValidEmail,
  isValidId,
  isValidDate,
  isValidTime,
  isValidPositiveInteger,
  parseStrictAmount,
  isValidHttpUrl,
};
