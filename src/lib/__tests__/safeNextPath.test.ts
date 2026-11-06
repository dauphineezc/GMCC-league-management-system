import { safeNextPath } from '../safeNextPath';

describe('safeNextPath', () => {
  it('allows same-origin relative paths', () => {
    expect(safeNextPath('/join?t=abc')).toBe('/join?t=abc');
    expect(safeNextPath('/team/123#roster')).toBe('/team/123#roster');
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.com',
    'evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    'javascript:alert(1)',
  ])('rejects %p', (value) => {
    expect(safeNextPath(value as string | null | undefined)).toBeNull();
  });
});
