import { join } from 'path';

import { parseBooleanEnv } from '../../../common/utils/bootstrap.utils';

export function isKoboAnnotationCaptureEnabled(): boolean {
  return parseBooleanEnv(process.env.KOBO_ANNOTATION_CAPTURE, false);
}

/** BookOrbit user id used to resolve ContentId → bookId during capture. Required when capture is on. */
export function getKoboCaptureUserId(): number | null {
  const raw = process.env.KOBO_CAPTURE_USER_ID?.trim();
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function getKoboCaptureOutputDir(): string {
  const custom = process.env.KOBO_CAPTURE_OUTPUT_DIR?.trim();
  if (custom) return custom;
  return join(process.cwd(), '.kobo-captures');
}
