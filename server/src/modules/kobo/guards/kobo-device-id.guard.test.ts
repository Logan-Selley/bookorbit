import { UnauthorizedException } from '@nestjs/common';

import { Permission } from '@bookorbit/types';

import { KoboDeviceIdGuard } from './kobo-device-id.guard';

function makeContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('KoboDeviceIdGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without x-kobo-deviceid', async () => {
    const guard = new KoboDeviceIdGuard(
      { query: { koboDevices: { findFirst: vi.fn() } } } as never,
      { findByIdWithPermissions: vi.fn() } as never,
      {
        userHas: vi.fn(),
      } as never,
    );

    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toThrow('Device ID missing');
  });

  it('rejects unknown hardware IDs', async () => {
    const db = { query: { koboDevices: { findFirst: vi.fn().mockResolvedValue(undefined) } } };
    const guard = new KoboDeviceIdGuard(db as never, { findByIdWithPermissions: vi.fn() } as never, { userHas: vi.fn() } as never);

    await expect(guard.canActivate(makeContext({ headers: { 'x-kobo-deviceid': 'hw-unknown' } }))).rejects.toThrow('Invalid device ID');
  });

  it('rejects users without Kobo sync permission', async () => {
    const db = { query: { koboDevices: { findFirst: vi.fn().mockResolvedValue({ userId: 7, koboHardwareId: 'hw-1' }) } } };
    const userService = { findByIdWithPermissions: vi.fn().mockResolvedValue({ id: 7, active: true }) };
    const permissionService = { userHas: vi.fn().mockReturnValue(false) };
    const guard = new KoboDeviceIdGuard(db as never, userService as never, permissionService as never);

    await expect(guard.canActivate(makeContext({ headers: { 'x-kobo-deviceid': 'hw-1' } }))).rejects.toThrow('Kobo sync permission revoked');
    expect(permissionService.userHas).toHaveBeenCalledWith({ id: 7, active: true }, Permission.KoboSync);
  });

  it('attaches user and device context for paired hardware IDs', async () => {
    const db = { query: { koboDevices: { findFirst: vi.fn().mockResolvedValue({ userId: 7, koboHardwareId: 'hw-1' }) } } };
    const user = { id: 7, active: true, permissions: [Permission.KoboSync] };
    const userService = { findByIdWithPermissions: vi.fn().mockResolvedValue(user) };
    const permissionService = { userHas: vi.fn().mockReturnValue(true) };
    const guard = new KoboDeviceIdGuard(db as never, userService as never, permissionService as never);
    const request = { headers: { 'x-kobo-deviceid': 'hw-1' } } as Record<string, unknown>;

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(request.user).toBe(user);
    expect(request.koboDeviceId).toEqual({ deviceId: 'hw-1', userId: 7 });
  });
});
