import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextData } from './request-context.interface';

@Injectable()
export class RequestContextService {
  private readonly asyncLocalStorage =
    new AsyncLocalStorage<RequestContextData>();

  run<T>(context: RequestContextData, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  getContext(): RequestContextData | undefined {
    return this.asyncLocalStorage.getStore();
  }

  getRequestId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.requestId;
  }

  getUserId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.userId;
  }

  getOrganisationId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.organisationId;
  }

  setUserContext(userId: string, organisationId: string): void {
    const store = this.asyncLocalStorage.getStore();

    if (!store) {
      throw new Error(
        'Cannot set user context outside an active request context',
      );
    }

    store.userId = userId;
    store.organisationId = organisationId;
  }
}
