import { describe, expect, it } from 'vitest';
import { isTyping, shouldReload } from './autoUpdate';

describe('shouldReload', () => {
  it('reloads for a version that is not the running one', () => {
    expect(shouldReload('b2', 'a1', null)).toBe(true);
  });

  it('does nothing when the version is the same, unknown, or already tried', () => {
    expect(shouldReload('a1', 'a1', null)).toBe(false);
    expect(shouldReload(null, 'a1', null)).toBe(false);
    expect(shouldReload(undefined, 'a1', null)).toBe(false);
    expect(shouldReload('', 'a1', null)).toBe(false);
    // a version that did not stick after one reload must not reload again and again
    expect(shouldReload('b2', 'a1', 'b2')).toBe(false);
  });

  it('reloads again for a version still newer than the one tried', () => {
    expect(shouldReload('c3', 'a1', 'b2')).toBe(true);
  });
});

describe('isTyping', () => {
  // (the tests run without a DOM: the function only reads the tag and isContentEditable)
  const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as Element;

  it('knows the fields where a person writes', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(isTyping(el(tag))).toBe(true);
    expect(isTyping(el('DIV', true))).toBe(true);
  });

  it('is not typing on anything else', () => {
    expect(isTyping(el('BUTTON'))).toBe(false);
    expect(isTyping(el('DIV'))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
