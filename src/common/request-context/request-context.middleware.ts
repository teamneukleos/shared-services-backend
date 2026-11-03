import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContextData } from './request-context.interface';
import { RequestContextService } from './request-context.service';

const MAX_REQUEST_ID_LENGTH = 128;

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = this.resolveRequestId(req.header('x-request-id'));
    const context: RequestContextData = {
      requestId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined,
    };

    res.setHeader('X-Request-Id', requestId);

    this.requestContextService.run(context, () => {
      next();
    });
  }

  resolveRequestId(incoming: string | undefined): string {
    if (typeof incoming !== 'string') {
      return randomUUID();
    }

    const trimmed = incoming.trim();

    if (
      trimmed.length === 0 ||
      trimmed.length > MAX_REQUEST_ID_LENGTH ||
      hasControlCharacters(trimmed)
    ) {
      return randomUUID();
    }

    return trimmed;
  }
}
