import { describe, expect, it } from 'vitest';
import { resolveAllowedOrigins } from './cors-config.js';

describe('resolveAllowedOrigins', () => {
  it('allow-lists the production frontend in production', () => {
    const origins = resolveAllowedOrigins({ NODE_ENV: 'production' });
    expect(origins).toContain('https://finflow-mu-nine.vercel.app');
  });
  it('keeps local dev servers in non-production', () => {
    const origins = resolveAllowedOrigins({ NODE_ENV: 'development' });
    expect(origins).toEqual(expect.arrayContaining([
      'http://localhost:5173',
      'http://localhost:3000',
    ]));
    expect(origins).not.toContain('https://finflow-mu-nine.vercel.app');
  });
  it('lets TRUSTED_ORIGINS override the defaults', () => {
    const origins = resolveAllowedOrigins({
      NODE_ENV: 'production',
      TRUSTED_ORIGINS: 'https://example.com, https://preview-123.vercel.app ',
    });
    expect(origins).toEqual(['https://example.com', 'https://preview-123.vercel.app']);
  });
  it('treats an explicitly empty TRUSTED_ORIGINS as no browser origins', () => {
    expect(resolveAllowedOrigins({ NODE_ENV: 'production', TRUSTED_ORIGINS: '' })).toEqual([]);
  });
});
