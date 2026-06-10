import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { getKoboCaptureUserId } from './kobo-capture.config';

export interface KoboCaptureContext {
  captureUserId: number | null;
  deviceId: string | null;
}

/** Spike-only guard: no production auth; requires KOBO_CAPTURE_USER_ID for book resolution. */
@Injectable()
export class KoboCaptureSpikeGuard implements CanActivate {
  private readonly logger = new Logger(KoboCaptureSpikeGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawDeviceId = request.headers['x-kobo-deviceid'];
    const deviceId = (Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId)?.trim() ?? null;
    const captureUserId = getKoboCaptureUserId();

    if (captureUserId == null) {
      this.logger.warn('KOBO_CAPTURE_USER_ID is not set — ContentId resolution will be skipped');
    }

    (request as unknown as Record<string, unknown>).koboCapture = {
      captureUserId,
      deviceId,
    } satisfies KoboCaptureContext;

    if (!deviceId) {
      throw new UnauthorizedException('Device ID missing (x-kobo-deviceid)');
    }

    return true;
  }
}
