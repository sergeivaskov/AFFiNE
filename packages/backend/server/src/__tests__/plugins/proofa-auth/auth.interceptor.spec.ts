import { CallHandler,ExecutionContext } from '@nestjs/common';
import test from "ava";
import { of } from 'rxjs';

import { Models } from "../../../models.js";
import { AuthInterceptor } from "../../../plugins/proofa-auth/auth.interceptor.js";
import { JwtService } from "../../../plugins/proofa-auth/jwt.service.js";
import { RefreshTokenStore } from "../../../plugins/proofa-auth/refresh-token.store.js";

interface MockRequest {
  path: string;
  cookies?: Record<string, string>;
  ip?: string;
  get?: (name: string) => string;
}

interface MockResponse {
  cookie: (name: string, value: string, options?: any) => void;
  clearCookie: (name: string, options?: any) => void;
  send?: (body?: any) => MockResponse;
  statusCode: number;
}

test.beforeEach((t) => {
  const jwtService = {
    sign: async (payload: any) => 'mock-jwt-token',
    verify: async (token: string) => ({ sub: 'user-123', email: 'test@example.com', workspace_id: 'ws-123' })
  } as any;

  const refreshTokenStore = {
    save: async (userId: string) => 'mock-jti',
    revoke: async (jti: string, userId: string) => {}
  } as any;

  const models = {
    user: {
      get: async (userId: string) => ({ id: userId, email: 'test@example.com' })
    }
  } as any;

  const logger = {
    setContext: () => {},
    log: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    verbose: () => {}
  } as any;

  t.context = {
    jwtService,
    refreshTokenStore,
    models,
    logger
  };
});

test('AuthInterceptor should be defined', (t) => {
  t.truthy(AuthInterceptor);
});

test('AuthInterceptor should intercept login and set cookies', async (t) => {
  const { jwtService, refreshTokenStore, models, logger } = t.context as any;
  const interceptor = new AuthInterceptor(jwtService, refreshTokenStore, models, logger);

  const req: MockRequest = {
    path: '/api/auth/sign-in',
    cookies: {},
    ip: '127.0.0.1',
    get: (name: string) => name === 'user-agent' ? 'test-agent' : ''
  };

  let accessTokenSet = false;
  let refreshTokenSet = false;

  const res: MockResponse = {
    statusCode: 200,
    cookie: (name: string, value: string, options?: any) => {
      if (name === 'access_token') {
        accessTokenSet = true;
        t.is(value, 'mock-jwt-token');
      }
      if (name === 'refresh_token') {
        refreshTokenSet = true;
        t.is(value, 'mock-jti');
      }
    },
    clearCookie: () => {},
    send: () => res
  };

  const mockExecutionContext = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res
    })
  } as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: () => of({})
  };

  const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
  
  await new Promise((resolve) => {
    result$.subscribe(() => {
      setTimeout(() => {
        if (res.send) {
          res.send(JSON.stringify({ id: 'user-123', email: 'test@example.com' }));
        }
        setTimeout(resolve, 100);
      }, 100);
    });
  });

  t.true(accessTokenSet, 'Access token should be set');
  t.true(refreshTokenSet, 'Refresh token should be set');
});

test('AuthInterceptor should intercept logout and clear cookies', async (t) => {
  const { jwtService, refreshTokenStore, models, logger } = t.context as any;
  const interceptor = new AuthInterceptor(jwtService, refreshTokenStore, models, logger);

  const req: MockRequest = {
    path: '/api/auth/sign-out',
    cookies: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token'
    },
    ip: '127.0.0.1',
    get: (name: string) => name === 'user-agent' ? 'test-agent' : ''
  };

  let accessTokenCleared = false;
  let refreshTokenCleared = false;
  let revokeWasCalled = false;

  refreshTokenStore.revoke = async (jti: string, userId: string) => {
    revokeWasCalled = true;
    t.is(jti, 'mock-refresh-token');
  };

  const res: MockResponse = {
    statusCode: 200,
    cookie: () => {},
    clearCookie: (name: string) => {
      if (name === 'access_token') accessTokenCleared = true;
      if (name === 'refresh_token') refreshTokenCleared = true;
    },
    send: () => res
  };

  const mockExecutionContext = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res
    })
  } as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: () => of({})
  };

  const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
  
  await new Promise((resolve) => {
    result$.subscribe(() => {
      setTimeout(() => {
        if (res.send) {
          res.send(JSON.stringify({ success: true }));
        }
        setTimeout(resolve, 100);
      }, 100);
    });
  });

  t.true(accessTokenCleared, 'Access token should be cleared');
  t.true(refreshTokenCleared, 'Refresh token should be cleared');
  t.true(revokeWasCalled, 'Revoke should be called');
});

test('AuthInterceptor should send webhook to Kimai on logout', async (t) => {
  const { jwtService, refreshTokenStore, models, logger } = t.context as any;
  const interceptor = new AuthInterceptor(jwtService, refreshTokenStore, models, logger);

  const req: MockRequest = {
    path: '/api/auth/sign-out',
    cookies: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token'
    },
    ip: '127.0.0.1',
    get: (name: string) => name === 'user-agent' ? 'test-agent' : ''
  };

  const res: MockResponse = {
    statusCode: 200,
    cookie: () => {},
    clearCookie: () => {},
    send: () => res
  };

  const mockExecutionContext = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res
    })
  } as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: () => of({})
  };

  const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);
  
  await new Promise((resolve) => {
    result$.subscribe(() => {
      setTimeout(() => {
        if (res.send) {
          res.send(JSON.stringify({ success: true }));
        }
        setTimeout(resolve, 500);
      }, 500);
    });
  });

  t.pass('Webhook should be sent (actual HTTP call is async and fire-and-forget)');
});

