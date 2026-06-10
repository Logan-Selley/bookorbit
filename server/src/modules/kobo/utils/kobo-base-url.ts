import type { FastifyRequest } from 'fastify';

export function buildKoboBaseUrl(req: FastifyRequest): string {
  const fwdHost = req.headers['x-forwarded-host'];
  const fwdPort = req.headers['x-forwarded-port'];
  const fwdProto = req.headers['x-forwarded-proto'];
  const hasForwarded = fwdHost || fwdPort || fwdProto;
  const proto = (fwdProto as string | undefined) ?? req.protocol;
  const headerHost = fwdHost ?? req.headers.host;
  let host = headerHost ? (Array.isArray(headerHost) ? headerHost[0] : headerHost) : req.hostname;

  if (!host.includes(':')) {
    const port = fwdPort ? (Array.isArray(fwdPort) ? fwdPort[0] : fwdPort) : null;
    if (port) {
      const isDefault = (proto === 'http' && port === '80') || (proto === 'https' && port === '443');
      if (!isDefault) host = host + ':' + port;
    } else if (!hasForwarded) {
      const localPort = req.socket?.localPort;
      const isDefault = (proto === 'http' && localPort === 80) || (proto === 'https' && localPort === 443);
      if (localPort && !isDefault) host = host + ':' + String(localPort);
    }
  }

  return proto + '://' + host;
}
