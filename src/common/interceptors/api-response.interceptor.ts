import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import {
  ApiSuccessResponse,
  ControllerSuccessPayload,
} from '../interfaces/api-response.interface';
import { RequestContextService } from '../request-context/request-context.service';

const DEFAULT_SUCCESS_MESSAGE = 'Request completed successfully';

@Injectable()
export class ApiResponseInterceptor<T = unknown>
  implements
    NestInterceptor<T, ApiSuccessResponse<unknown> | T | StreamableFile>
{
  constructor(private readonly requestContextService: RequestContextService) {}

  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<unknown> | T | StreamableFile> {
    return next.handle().pipe(map((body) => this.toSuccessResponse(body)));
  }

  toSuccessResponse(
    body: T | ControllerSuccessPayload | ApiSuccessResponse | StreamableFile,
  ): ApiSuccessResponse<unknown> | T | StreamableFile {
    if (body instanceof StreamableFile) {
      return body;
    }

    if (this.isAlreadyWrapped(body)) {
      if (body.requestId !== undefined) {
        return body;
      }

      return {
        ...body,
        requestId: this.requestContextService.getRequestId(),
      };
    }

    const requestId = this.requestContextService.getRequestId();

    if (this.isControllerPayload(body)) {
      return {
        success: true,
        message: body.message ?? DEFAULT_SUCCESS_MESSAGE,
        data: body.data,
        meta: body.meta ?? null,
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    return {
      success: true,
      message: DEFAULT_SUCCESS_MESSAGE,
      data: body as unknown,
      meta: null,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  private isAlreadyWrapped(body: unknown): body is ApiSuccessResponse {
    return (
      typeof body === 'object' &&
      body !== null &&
      !Array.isArray(body) &&
      'success' in body &&
      body.success === true
    );
  }

  private isControllerPayload(body: unknown): body is ControllerSuccessPayload {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return false;
    }

    if (!('data' in body)) {
      return false;
    }

    return Object.keys(body).every(
      (key) => key === 'data' || key === 'message' || key === 'meta',
    );
  }
}
