import { describe, expect, it } from 'vitest';
import { isSecretaryOnly } from './scope.ts';

describe('isSecretaryOnly', () => {
  it('is true for a plain secretary', () => {
    expect(isSecretaryOnly('secretary')).toBe(true);
  });

  it('trims whitespace in the comma-separated role field', () => {
    expect(isSecretaryOnly(' secretary ')).toBe(true);
    expect(isSecretaryOnly('secretary, auditor')).toBe(true); // auditor grants no org-wide booking
  });

  it('is false when the actor also holds a broader booking role', () => {
    expect(isSecretaryOnly('secretary,receptionist')).toBe(false);
    expect(isSecretaryOnly('secretary,system_administrator')).toBe(false);
    expect(isSecretaryOnly('host,secretary')).toBe(false);
  });

  it('is false for non-secretaries', () => {
    expect(isSecretaryOnly('receptionist')).toBe(false);
    expect(isSecretaryOnly('system_administrator')).toBe(false);
    expect(isSecretaryOnly('host')).toBe(false);
  });

  it('is false for empty/missing roles', () => {
    expect(isSecretaryOnly(null)).toBe(false);
    expect(isSecretaryOnly(undefined)).toBe(false);
    expect(isSecretaryOnly('')).toBe(false);
  });
});
