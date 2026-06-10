import { BadRequestException, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

const KOBO_READING_SERVICES_BASE = 'https://readingservices.kobo.com';
const KOBO_READING_SERVICES_HOSTNAME = 'readingservices.kobo.com';

const FORWARD_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'if-match',
  'if-none-match',
  'user-agent',
  'x-kobo-affiliatename',
  'x-kobo-appversion',
  'x-kobo-deviceid',
  'x-kobo-devicemodel',
  'x-kobo-deviceos',
  'x-kobo-deviceosversion',
  'x-kobo-platformid',
  'x-kobo-synctokenversion',
];

export interface KoboReadingServicesProxyResult {
  targetUrl: string;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

@Injectable()
export class KoboReadingServicesProxyService {
  async forward(req: FastifyRequest): Promise<KoboReadingServicesProxyResult> {
    const targetUrl = this.buildTargetUrl(req.url);

    const headers: Record<string, string> = {};
    for (const key of FORWARD_HEADERS) {
      const val = req.headers[key];
      if (val) headers[key] = Array.isArray(val) ? val[0] : val;
    }

    let body: string | undefined;
    if (!['GET', 'HEAD'].includes(req.method) && req.body != null) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const headersOut: Record<string, string> = {};
    upstream.headers.forEach((value, key) => {
      headersOut[key] = value;
    });

    const bodyText = await upstream.text();

    return {
      targetUrl,
      status: upstream.status,
      headers: headersOut,
      bodyText,
    };
  }

  sendToClient(reply: FastifyReply, result: KoboReadingServicesProxyResult): void {
    reply.status(result.status);
    for (const [key, value] of Object.entries(result.headers)) {
      if (!['transfer-encoding', 'connection', 'content-encoding', 'content-length'].includes(key.toLowerCase())) {
        reply.header(key, value);
      }
    }
    reply.send(result.bodyText);
  }

  private buildTargetUrl(requestUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(requestUrl, KOBO_READING_SERVICES_BASE);
    } catch {
      throw new BadRequestException('Invalid proxy path');
    }
    if (parsed.hostname !== KOBO_READING_SERVICES_HOSTNAME) {
      throw new BadRequestException('Invalid proxy path');
    }
    return parsed.toString();
  }
}
