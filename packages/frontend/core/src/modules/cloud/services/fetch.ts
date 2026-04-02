import { DebugLogger } from '@affine/debug';
import { UserFriendlyError } from '@affine/error';
import { fromPromise, Service } from '@toeverything/infra';

import type { ServerService } from './server';

const logger = new DebugLogger('affine:fetch');

export type FetchInit = RequestInit & { timeout?: number; _isRetry?: boolean };

// Global promise to deduplicate refresh requests
let refreshTokenPromise: Promise<boolean> | null = null;

export class FetchService extends Service {
  constructor(private readonly serverService: ServerService) {
    super();
  }
  rxFetch = (
    input: string,
    init?: RequestInit & {
      // https://github.com/microsoft/TypeScript/issues/54472
      priority?: 'auto' | 'low' | 'high';
    } & {
      traceEvent?: string;
    }
  ) => {
    return fromPromise((signal: AbortSignal) => {
      return this.fetch(input, { signal, ...init });
    });
  };

  /**
   * fetch with custom custom timeout and error handling.
   */
  fetch = async (input: string, init?: FetchInit): Promise<Response> => {
    logger.debug('fetch', input);
    const externalSignal = init?.signal;
    if (externalSignal?.aborted) {
      throw externalSignal.reason;
    }
    const abortController = new AbortController();
    externalSignal?.addEventListener('abort', reason => {
      abortController.abort(reason);
    });

    const timeout = init?.timeout ?? 15000;
    const timeoutId =
      timeout > 0
        ? setTimeout(() => {
            abortController.abort(new Error('timeout after ' + timeout + 'ms'));
          }, timeout)
        : undefined;

    let res: Response;

    try {
      res = await globalThis.fetch(
        new URL(input, this.serverService.server.serverMetadata.baseUrl),
        {
          ...init,
          credentials: init?.credentials ?? 'include',
          signal: abortController.signal,
          headers: {
            ...init?.headers,
            'x-affine-version': BUILD_CONFIG.appVersion,
          },
        }
      );
    } catch (err: any) {
      const isAbort =
        err?.name === 'AbortError' ||
        err?.code === 'ABORT_ERR' ||
        err?.type === 'aborted' ||
        abortController.signal.aborted;

      const message =
        err?.message || (isAbort ? 'Request aborted' : 'Unknown network error');

      throw new UserFriendlyError({
        status: isAbort ? 499 : 504,
        code: isAbort ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
        type: isAbort ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
        name: isAbort ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
        message: `Network error: ${message}`,
        stacktrace: err?.stack,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      // Handle 401 Unauthorized by trying to refresh the token
      if (res.status === 401 && !init?._isRetry && !input.includes('/api/auth/refresh') && !input.includes('/api/auth/sign-in') && !input.includes('/api/auth/sign-out')) {
        logger.debug('401 Unauthorized, attempting to refresh token...');
        
        if (!refreshTokenPromise) {
          refreshTokenPromise = globalThis.fetch(
            new URL('/api/auth/refresh', this.serverService.server.serverMetadata.baseUrl),
            { method: 'POST', credentials: 'include' }
          ).then(r => {
            refreshTokenPromise = null;
            return r.ok;
          }).catch(() => {
            refreshTokenPromise = null;
            return false;
          });
        }

        const refreshed = await refreshTokenPromise;
        if (refreshed) {
          logger.debug('Token refreshed successfully, retrying original request');
          // Retry the original request (without timeout recursion issues hopefully)
          return this.fetch(input, { ...init, _isRetry: true });
        } else {
          logger.debug('Token refresh failed');
          // If refresh failed, we should probably trigger a logout or redirect to login
          // But for now, we just let the 401 error propagate
        }
      }

      if (res.status === 504) {
        const error = new Error('Gateway Timeout');
        logger.debug('network error', error);
        throw new UserFriendlyError({
          status: 504,
          code: 'NETWORK_ERROR',
          type: 'NETWORK_ERROR',
          name: 'NETWORK_ERROR',
          message: 'Gateway Timeout',
          stacktrace: error.stack,
        });
      } else {
        if (res.headers.get('Content-Type')?.startsWith('application/json')) {
          throw UserFriendlyError.fromAny(await res.json());
        } else {
          throw UserFriendlyError.fromAny(await res.text());
        }
      }
    }

    return res;
  };
}
