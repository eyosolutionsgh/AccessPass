import { describe, expect, it } from 'vitest';
import { decodeDataUrl } from './storage.ts';

// 1x1 transparent PNG.
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;

describe('decodeDataUrl', () => {
  it('decodes an allowed image data URL into mime + bytes + extension', () => {
    const { mime, bytes, ext } = decodeDataUrl(PNG_1PX, { allowedMime: ALLOWED, maxBytes: 1_000 });
    expect(mime).toBe('image/png');
    expect(ext).toBe('png');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('rejects a disallowed mime type', () => {
    const gif = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    expect(() => decodeDataUrl(gif, { allowedMime: ALLOWED, maxBytes: 1_000 })).toThrow();
  });

  it('rejects an image larger than the cap', () => {
    expect(() => decodeDataUrl(PNG_1PX, { allowedMime: ALLOWED, maxBytes: 1 })).toThrow();
  });

  it('rejects a non-data-url string', () => {
    expect(() =>
      decodeDataUrl('not-a-data-url', { allowedMime: ALLOWED, maxBytes: 1_000 }),
    ).toThrow();
  });
});
