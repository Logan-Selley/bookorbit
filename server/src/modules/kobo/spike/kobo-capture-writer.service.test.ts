import { formatCaptureSummary, parseUpstreamBody, type KoboCaptureRecord } from './kobo-capture-writer.service';

describe('parseUpstreamBody', () => {
  it('parses JSON responses', () => {
    expect(parseUpstreamBody('{"ETag":"abc"}')).toEqual({ ETag: 'abc' });
  });

  it('returns raw text for non-JSON', () => {
    expect(parseUpstreamBody('not json')).toBe('not json');
  });
});

describe('formatCaptureSummary', () => {
  const base: KoboCaptureRecord = {
    capturedAt: '2026-06-07T12:00:00.000Z',
    captureUserId: 7,
    deviceId: 'hw-1',
    request: { method: 'POST', path: '/api/v3/content/checkforchanges', headers: {}, body: [] },
    resolution: { entries: [{ contentId: 'uuid-book-1', bookId: 42, managed: true }] },
    upstream: {
      url: 'https://readingservices.kobo.com/api/v3/content/checkforchanges',
      status: 200,
      headers: { etag: 'token-1' },
      body: { ChangedContentIds: ['uuid-book-1'] },
    },
  };

  it('includes path, etag, resolution, and filename', () => {
    const line = formatCaptureSummary(base, 'capture.json');
    expect(line).toContain('checkforchanges');
    expect(line).toContain('etag=token-1');
    expect(line).toContain('uuid-book');
    expect(line).toContain('file=capture.json');
  });
});
