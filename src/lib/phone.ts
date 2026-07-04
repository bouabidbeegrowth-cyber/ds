const ALGERIAN_PHONE_PATTERN = /^(?:\+213[2-4]\d{7}|\+213[5-7]\d{8}|0[2-4]\d{7}|0[5-7]\d{8})$/;

export function normalizePhone(value: string): string {
  return value.replace(/[\s.-]/g, '');
}

export function isAlgerianPhoneNumber(value: string): boolean {
  const normalized = normalizePhone(value.trim());
  if (!normalized) return false;
  return ALGERIAN_PHONE_PATTERN.test(normalized);
}
