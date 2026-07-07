/** Success envelope shape, PRD §17: `{ success, data, meta }`. */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: {
    cursor?: string;
    hasMore?: boolean;
  };
}

/** Error envelope shape, PRD §17: `{ success: false, error: { code, message, traceId, details } }`. */
export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    traceId: string;
    details?: Array<{ field: string; code: string }>;
  };
}
