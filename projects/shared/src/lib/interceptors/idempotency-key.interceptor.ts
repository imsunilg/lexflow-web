import { HttpInterceptorFn } from '@angular/common/http';

/** Endpoints requiring an Idempotency-Key per PRD §27 (UUID v4, retained 48h server-side). */
const IDEMPOTENT_PATH_PATTERNS = [
  /\/payments(\/|$)/,
  /\/refunds(\/|$)/,
  /\/trust\//,
  /\/invoices\/[^/]+\/send$/,
];

/** Injects a fresh `Idempotency-Key` header on POSTs to endpoints that require replay-safety. */
export const idempotencyKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const needsKey =
    req.method === 'POST' && IDEMPOTENT_PATH_PATTERNS.some((pattern) => pattern.test(req.url));

  if (!needsKey || req.headers.has('Idempotency-Key')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'Idempotency-Key': crypto.randomUUID() } }));
};
