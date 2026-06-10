import { All, Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { Public } from '../../../common/decorators/public.decorator';
import { KoboBookIdentityService } from '../services/kobo-book-identity.service';
import type { KoboCaptureContext } from './kobo-capture-spike.guard';
import { KoboCaptureSpikeGuard } from './kobo-capture-spike.guard';
import { KoboCaptureWriterService, parseUpstreamBody, type KoboCaptureRecord } from './kobo-capture-writer.service';
import { KoboReadingServicesProxyService } from './kobo-reading-services-proxy.service';

interface ContentChangeEntry {
  ContentId?: string;
  ETag?: string;
  etag?: string;
}

@Controller()
@Public()
@UseGuards(KoboCaptureSpikeGuard)
@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: false }))
export class KoboAnnotationCaptureController {
  constructor(
    private readonly bookIdentityService: KoboBookIdentityService,
    private readonly proxyService: KoboReadingServicesProxyService,
    private readonly captureWriter: KoboCaptureWriterService,
  ) {}

  @Post('api/v3/content/checkforchanges')
  async checkForChanges(@Req() req: FastifyRequest, @Res() reply: FastifyReply, @Body() body: ContentChangeEntry[]) {
    const entries = Array.isArray(body) ? body : [];
    const contentIds = entries.map((e) => e.ContentId).filter((id): id is string => Boolean(id));
    await this.captureAndProxy(req, reply, contentIds);
  }

  @Get('api/v3/content/:contentId/annotations')
  async getAnnotations(@Req() req: FastifyRequest, @Res() reply: FastifyReply, @Param('contentId') contentId: string) {
    await this.captureAndProxy(req, reply, [contentId]);
  }

  @Patch('api/v3/content/:contentId/annotations')
  async patchAnnotations(@Req() req: FastifyRequest, @Res() reply: FastifyReply, @Param('contentId') contentId: string) {
    await this.captureAndProxy(req, reply, [contentId]);
  }

  @All('api/UserStorage/*')
  async userStorage(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    await this.captureAndProxy(req, reply, []);
  }

  private async captureAndProxy(req: FastifyRequest, reply: FastifyReply, contentIds: string[]): Promise<void> {
    const ctx = (req as unknown as Record<string, unknown>).koboCapture as KoboCaptureContext;
    const resolution = await this.resolveContentIds(ctx.captureUserId, contentIds);
    const upstream = await this.proxyService.forward(req);

    const record: KoboCaptureRecord = {
      capturedAt: new Date().toISOString(),
      captureUserId: ctx.captureUserId,
      deviceId: ctx.deviceId,
      request: {
        method: req.method,
        path: req.url,
        headers: { ...req.headers },
        body: req.body ?? null,
      },
      resolution: { entries: resolution },
      upstream: {
        url: upstream.targetUrl,
        status: upstream.status,
        headers: upstream.headers,
        body: parseUpstreamBody(upstream.bodyText),
      },
    };

    await this.captureWriter.persist(record);
    this.proxyService.sendToClient(reply, upstream);
  }

  private async resolveContentIds(
    captureUserId: number | null,
    contentIds: string[],
  ): Promise<Array<{ contentId: string; bookId: number | null; managed: boolean }>> {
    if (captureUserId == null) {
      return contentIds.map((contentId) => ({ contentId, bookId: null, managed: false }));
    }

    const entries: Array<{ contentId: string; bookId: number | null; managed: boolean }> = [];
    for (const contentId of contentIds) {
      const bookId = await this.bookIdentityService.resolveBookIdByEntitlementId(captureUserId, contentId);
      entries.push({ contentId, bookId, managed: bookId != null });
    }
    return entries;
  }
}
