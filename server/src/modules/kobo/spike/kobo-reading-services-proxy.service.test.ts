import { BadRequestException } from '@nestjs/common';

import { KoboReadingServicesProxyService } from './kobo-reading-services-proxy.service';

describe('KoboReadingServicesProxyService', () => {
  const service = new KoboReadingServicesProxyService();

  it('rejects paths outside readingservices.kobo.com', () => {
    expect(() => (service as unknown as { buildTargetUrl: (u: string) => string }).buildTargetUrl('https://evil.com/x')).toThrow(BadRequestException);
  });

  it('builds target URL for api/v3 paths', () => {
    const url = (service as unknown as { buildTargetUrl: (u: string) => string }).buildTargetUrl('/api/v3/content/checkforchanges');
    expect(url).toBe('https://readingservices.kobo.com/api/v3/content/checkforchanges');
  });
});
