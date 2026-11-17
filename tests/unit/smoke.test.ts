import { expect, test } from 'vitest';

test('runs in WebKit', () => {
  expect(navigator.userAgent).toContain('AppleWebKit');
  expect(navigator.userAgent).not.toContain('Chrome');
});
