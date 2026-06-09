import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { FastifyRequest } from 'fastify';

import { Permission } from '@bookorbit/types';
import { DB } from '../../../db/db.module';
import * as schema from '../../../db/schema';
import type { RequestUser } from '../../../common/types/request-user';
import { PermissionService } from '../../../common/services/permission.service';
import { UserService } from '../../user/user.service';

type Db = NodePgDatabase<typeof schema>;

export interface KoboDeviceIdContext {
  deviceId: string;
  userId: number;
}

// Reading-services routes authenticate via x-kobo-deviceid against paired kobo_devices rows
// (hardware ID is bound on the first store API request after pairing).

@Injectable()
export class KoboDeviceIdGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const rawDeviceId = request.headers['x-kobo-deviceid'];
    const deviceId = (Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId)?.trim();

    if (!deviceId) throw new UnauthorizedException('Device ID missing');

    const device = await this.db.query.koboDevices.findFirst({
      where: eq(schema.koboDevices.koboHardwareId, deviceId),
    });
    if (!device) throw new UnauthorizedException('Invalid device ID');

    const user = await this.userService.findByIdWithPermissions(device.userId);
    if (!user || !user.active) throw new UnauthorizedException('Account not found or disabled');
    if (!this.permissionService.userHas(user, Permission.KoboSync)) throw new UnauthorizedException('Kobo sync permission revoked');

    (request as unknown as Record<string, unknown>).user = user as RequestUser;
    (request as unknown as Record<string, unknown>).koboDeviceId = {
      deviceId,
      userId: device.userId,
    } satisfies KoboDeviceIdContext;

    return true;
  }
}
