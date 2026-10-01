export const normalizeUserName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export const isValidUserName = (value: string): boolean =>
  value.length >= 2 && value.length <= 40 && /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(value);