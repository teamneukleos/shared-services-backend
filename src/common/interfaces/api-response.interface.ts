export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta: unknown;
  timestamp: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors: unknown[];
  path: string;
  timestamp: string;
  requestId?: string;
}

export interface ControllerSuccessPayload<T = unknown> {
  data: T;
  message?: string;
  meta?: unknown;
}
