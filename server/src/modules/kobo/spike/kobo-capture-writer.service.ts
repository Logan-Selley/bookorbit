import { mkdir, appendFile, writeFile } from 'fs/promises';
import { join } from 'path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { getKoboCaptureOutputDir } from './kobo-capture.config';

export interface KoboCaptureRecord {
  capturedAt: string;
  captureUserId: number | null;
  deviceId: string | null;
  request: {
    method: string;
    path: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  };
  resolution: {
    entries: Array<{ contentId: string; bookId: number | null; managed: boolean }>;
  };
  upstream: {
    url: string;
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

@Injectable()
export class KoboCaptureWriterService implements OnModuleInit {
  private readonly logger = new Logger('kobo.capture');
  private outputDir = getKoboCaptureOutputDir();

  async onModuleInit(): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });
    this.logger.warn(`Annotation capture ACTIVE — writing to ${this.outputDir}`);
  }

  async persist(record: KoboCaptureRecord): Promise<string> {
    const slug = record.request.path.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80);
    const filename = `${record.capturedAt.replace(/[:.]/g, '-')}_${record.request.method}_${slug}.json`;
    const filepath = join(this.outputDir, filename);

    await writeFile(filepath, JSON.stringify(record, null, 2), 'utf8');

    const summary = formatCaptureSummary(record, filename);
    await appendFile(join(this.outputDir, 'capture.log'), summary + '\n', 'utf8');
    this.logger.log(summary);

    return filepath;
  }
}

export function formatCaptureSummary(record: KoboCaptureRecord, filename: string): string {
  const resolutions = record.resolution.entries.map((e) => `${e.contentId.slice(0, 8)}…→${e.bookId ?? 'null'}`).join(', ');
  const etag =
    record.upstream.headers.etag ??
    record.upstream.headers.ETag ??
    (typeof record.upstream.body === 'object' && record.upstream.body !== null && 'ETag' in record.upstream.body
      ? String((record.upstream.body as { ETag?: string }).ETag)
      : null);
  const changed =
    typeof record.upstream.body === 'object' && record.upstream.body !== null && 'ChangedContentIds' in record.upstream.body
      ? JSON.stringify((record.upstream.body as { ChangedContentIds?: string[] }).ChangedContentIds)
      : null;

  const parts = [
    record.capturedAt,
    `${record.request.method} ${record.request.path}`,
    `→ ${record.upstream.status}`,
    resolutions ? `resolved=[${resolutions}]` : null,
    etag ? `etag=${etag}` : null,
    changed ? `changed=${changed}` : null,
    `file=${filename}`,
  ].filter(Boolean);

  return parts.join(' | ');
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function parseUpstreamBody(bodyText: string): unknown {
  return tryParseJson(bodyText);
}
