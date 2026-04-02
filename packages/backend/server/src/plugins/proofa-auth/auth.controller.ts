import { Controller, Post, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService } from './jwt.service';
import { RefreshTokenStore } from './refresh-token.store';
import { Models } from '../../models';
import { Public } from '../../core/auth/guard';
import { getCookieOptions } from './cookie-options';

@Controller('/api/auth')
export class ProofaAuthController {
  private readonly logger = new Logger(ProofaAuthController.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly models: Models
  ) {}

  @Public()
  @Post('/refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const jti = req.cookies?.refresh_token;
    if (!jti) {
      this.logger.warn({
        event: 'refresh_failed',
        reason: 'no_refresh_token',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'No refresh token' });
    }

    const tokenData = await this.refreshTokenStore.validate(jti);
    if (!tokenData) {
      this.logger.warn({
        event: 'refresh_failed',
        reason: 'invalid_or_expired_token',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'Invalid or expired refresh token' });
    }

    // Token rotation: mark old as rotated (starts 30s grace period), issue new
    await this.refreshTokenStore.rotate(jti, tokenData.userId);
    const newJti = await this.refreshTokenStore.save(tokenData.userId, tokenData.workspaceId);

    // Get user email
    const user = await this.models.user.get(tokenData.userId);
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'User not found' });
    }

    const payload = {
      sub: tokenData.userId,
      email: user.email,
      workspaces: {}, // Populate properly
      kimai_role: 'ROLE_USER',
      workspace_id: tokenData.workspaceId
    };

    const accessToken = await this.jwtService.sign(payload);

    const cookieOptions = getCookieOptions('/');

    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });

    res.clearCookie('refresh_token', getCookieOptions('/api/auth/refresh'));
    res.clearCookie('refresh_token', getCookieOptions('/'));

    res.cookie('refresh_token', newJti, {
      ...getCookieOptions('/'),
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    this.logger.log({
      event: 'refresh_success',
      user_id: tokenData.userId,
      ip: req.ip,
      user_agent: req.get('user-agent')
    });

    return res.status(HttpStatus.OK).send({ success: true });
  }

  @Public()
  @Post('/workspace/switch')
  async switchWorkspace(@Req() req: Request, @Res() res: Response) {
    const targetWorkspaceId = req.body?.target_workspace_id;
    if (!targetWorkspaceId) {
      this.logger.warn({
        event: 'workspace_switch_failed',
        reason: 'missing_target_workspace_id',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.BAD_REQUEST).send({ message: 'Missing target_workspace_id' });
    }

    const accessToken = req.cookies?.access_token;
    if (!accessToken) {
      this.logger.warn({
        event: 'workspace_switch_failed',
        reason: 'no_access_token',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'No access token' });
    }

    try {
      const payload = await this.jwtService.verify(accessToken);
      
      const newPayload = {
        ...payload,
        workspace_id: targetWorkspaceId
      };
      
      const newAccessToken = await this.jwtService.sign(newPayload);
      
      const cookieOptions = getCookieOptions('/');

      res.cookie('access_token', newAccessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000
      });
      
      this.logger.log({
        event: 'workspace_switch_success',
        user_id: payload.sub,
        target_workspace_id: targetWorkspaceId,
        ip: req.ip,
        user_agent: req.get('user-agent')
      });

      return res.status(HttpStatus.OK).send({ success: true, workspace_id: targetWorkspaceId });
    } catch (e) {
      this.logger.warn({
        event: 'workspace_switch_failed',
        reason: 'invalid_access_token',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'Invalid access token' });
    }
  }

  @Public()
  @Post('/logout-all')
  async logoutAll(@Req() req: Request, @Res() res: Response) {
    const accessToken = req.cookies?.access_token;
    if (!accessToken) {
      this.logger.warn({
        event: 'logout_all_failed',
        reason: 'no_access_token',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'No access token' });
    }

    try {
      const payload = await this.jwtService.verify(accessToken);
      const userId = payload.sub as string;
      
      await this.refreshTokenStore.revokeAllForUser(userId);
      
      const cookieOptions = getCookieOptions('/');

      res.clearCookie('access_token', cookieOptions);
      res.clearCookie('refresh_token', getCookieOptions('/'));
      
      this.logger.log({
        event: 'logout_all_success',
        user_id: userId,
        ip: req.ip,
        user_agent: req.get('user-agent')
      });

      return res.status(HttpStatus.OK).send({ success: true });
    } catch (e) {
      this.logger.warn({
        event: 'logout_all_failed',
        reason: 'invalid_access_token',
        ip: req.ip,
        user_agent: req.get('user-agent')
      });
      return res.status(HttpStatus.UNAUTHORIZED).send({ message: 'Invalid access token' });
    }
  }
}
