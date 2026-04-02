import { CallHandler, ExecutionContext, Injectable, Logger,NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

import { Models } from '../../models';
import { getCookieOptions } from './cookie-options';
import { JwtService } from './jwt.service';
import { RefreshTokenStore } from './refresh-token.store';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuthInterceptor.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly models: Models
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    if (!req || !req.path) {
      return next.handle();
    }

    const isLogin = req.path === '/api/auth/sign-in' || req.path === '/api/auth/magic-link';
    const isLogout = req.path === '/api/auth/sign-out';

    if (isLogin) {
      const originalSend = res.send;
      const self = this;
      
      res.send = function (this: Response, body?: any): Response {
        res.send = originalSend; // Restore immediately to prevent recursion

        const selfRes = this;
        void (async () => {
          try {
            self.logger.debug(`Intercepted login response. Status: ${res.statusCode}, Body type: ${typeof body}`);
            
            if (res.statusCode >= 200 && res.statusCode < 300 && body) {
              let parsedBody = body;
              if (typeof body === 'string') {
                try {
                  parsedBody = JSON.parse(body);
                } catch (e) {
                  self.logger.debug(`Failed to parse body string: ${body.substring(0, 50)}...`);
                }
              }

              self.logger.debug(`Parsed body id: ${parsedBody?.id}, email: ${parsedBody?.email}`);

              if (parsedBody && parsedBody.id) {
                const userId = parsedBody.id;
                let email = parsedBody.email;
                
                if (!email) {
                  const user = await self.models.user.get(userId);
                  if (user) {
                    email = user.email;
                  }
                }
                
                if (email) {
                  const jti = await self.refreshTokenStore.save(userId);
                  
                  const payload = {
                    sub: userId,
                    email: email,
                    workspaces: {},
                    kimai_role: 'ROLE_USER'
                  };
                  
                  const accessToken = await self.jwtService.sign(payload);

                  selfRes.cookie('access_token', accessToken, {
                    ...getCookieOptions('/'),
                    maxAge: 15 * 60 * 1000
                  });

              selfRes.clearCookie('refresh_token', getCookieOptions('/api/auth/refresh'));
              selfRes.clearCookie('refresh_token', getCookieOptions('/'));

              selfRes.cookie('refresh_token', jti, {
                ...getCookieOptions('/'),
                maxAge: 7 * 24 * 60 * 60 * 1000
              });
                  
                  self.logger.log({
                    event: 'login_success',
                    user_id: userId,
                    ip: req.ip,
                    user_agent: req.get('user-agent'),
                    message: `Successfully issued tokens for user ${userId}`
                  });
                } else {
                  self.logger.debug(`Could not find email for user ${userId}`);
                }
              } else {
                self.logger.debug(`No id found in parsed body`);
              }
            }
          } catch (e) {
            self.logger.error(`Failed to process auth interception for ${req.path}`, e);
          } finally {
            originalSend.call(selfRes, body);
          }
        })();

        return this;
      };
    } else if (isLogout) {
      const originalSend = res.send;
      const self = this;
      
      res.send = function (this: Response, body?: any): Response {
        res.send = originalSend;

        const selfRes = this;
        void (async () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              selfRes.clearCookie('access_token', getCookieOptions('/'));
              selfRes.clearCookie('refresh_token', getCookieOptions('/'));

              let userId = '';
              let workspaceId = '';
              const jti = req.cookies?.refresh_token;
              if (jti) {
                const accessToken = req.cookies?.access_token;
                if (accessToken) {
                  try {
                    const payload = await self.jwtService.verify(accessToken);
                    userId = payload.sub as string;
                    workspaceId = (payload.workspace_id as string) || '';
                  } catch (e) {
                    // ignore
                  }
                }
                await self.refreshTokenStore.revoke(jti, userId);
                
                // Send Webhook to Kimai
                if (userId) {
                  try {
                    const kimaiUrl = process.env.KIMAI_INTERNAL_URL || 'http://kimai-nginx:80';
                    const secret = process.env.INTERNAL_WEBHOOK_SECRET || 'proofa-internal-secret-key-2024';
                    
                    self.logger.log(`Sending logout webhook to Kimai for user ${userId}`);
                    
                    void fetch(`${kimaiUrl}/auth/internal/webhook/logout`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Internal-Secret': secret
                      },
                      body: JSON.stringify({
                        user_id: userId,
                        workspace_id: workspaceId
                      })
                    }).then(res => {
                      if (!res.ok) {
                        self.logger.error(`Webhook to Kimai failed with status ${res.status}`);
                      } else {
                        self.logger.log(`Successfully sent webhook to Kimai for user ${userId}`);
                      }
                    }).catch(err => {
                      self.logger.error(`Failed to send webhook to Kimai: ${err.message}`);
                    });
                  } catch (err) {
                    self.logger.error(`Error preparing webhook: ${err}`);
                  }
                }
              }
              self.logger.log({
                event: 'logout_success',
                user_id: userId || 'unknown',
                ip: req.ip,
                user_agent: req.get('user-agent'),
                message: `Successfully cleared tokens on logout`
              });
            }
          } catch (e) {
            self.logger.error(`Failed to process auth interception for ${req.path}`, e);
          } finally {
            originalSend.call(selfRes, body);
          }
        })();

        return this;
      };
    }

    return next.handle();
  }
}
