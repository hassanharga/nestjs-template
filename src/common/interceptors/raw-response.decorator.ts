import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE = 'rawResponse';
/** Opt out for downloads or endpoints that implement their own response contract. */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true);
export const isInfrastructurePath = (path = '') =>
  path === '/metrics' || path === '/health' || path.startsWith('/health/');
