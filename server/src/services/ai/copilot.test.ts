import { describe, expect, it } from 'vitest';
import { AUTHORIZATION_RE, presenceFact } from './copilot.ts';

/**
 * The copilot must NEVER render an allow/deny verdict — a small model will happily hallucinate
 * "X is allowed on site" (even for a non-existent person). Authorization questions are detected
 * and answered deterministically; these guard that detection + the neutral phrasing.
 */
describe('copilot authorization guard', () => {
  it('detects permission/authorization wording', () => {
    for (const q of [
      'Is Olu allowed on site?',
      'is she permitted in',
      'has he been cleared',
      'does he have clearance',
      'is he banned',
      'is X barred from entry',
      'was the visit denied',
    ]) {
      expect(AUTHORIZATION_RE.test(q)).toBe(true);
    }
  });

  it('does not fire on ordinary operational questions', () => {
    for (const q of [
      'Who is currently on site?',
      'open incidents this week',
      'expected arrivals today',
      'how many visits yesterday',
      'list contractors on site',
    ]) {
      expect(AUTHORIZATION_RE.test(q)).toBe(false);
    }
  });

  it('presenceFact reports facts but never an allow/deny verdict', () => {
    const outputs = [
      presenceFact('Jane Doe', []),
      presenceFact('Jane Doe', ['checked_in']),
      presenceFact('Jane Doe', ['denied']),
      presenceFact('Jane Doe', ['approved', 'cancelled']),
    ];
    for (const text of outputs) {
      expect(text).not.toMatch(/\b(is )?(allowed|not allowed|permitted|may enter|cleared to enter)\b/i);
    }
    expect(presenceFact('Jane Doe', [])).toContain('no visit records');
    expect(presenceFact('Jane Doe', ['checked_in'])).toContain('checked in');
    expect(presenceFact('Jane Doe', ['denied'])).toContain('denied visit');
  });
});
