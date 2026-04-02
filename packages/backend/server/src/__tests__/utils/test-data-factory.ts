import { createHash } from 'crypto';
import { importPKCS8,SignJWT } from 'jose';

export interface TestUser {
  id: string;
  email: string;
  name?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  workspace_id?: string;
  workspaces?: Record<string, string[]>;
  kimai_role?: string;
}

export class TestDataFactory {
  private readonly jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.AFFINE_JWT_SECRET || 'test-secret-key-minimum-32-bytes-long-for-hs256-algorithm-needs-at-least-256-bits';
  }

  createTestUser(overrides?: Partial<TestUser>): TestUser {
    const uniqueId = this.generateUniqueId();
    return {
      id: overrides?.id ?? `test-user-${uniqueId}`,
      email: overrides?.email ?? `test-${uniqueId}@example.com`,
      name: overrides?.name ?? `Test User ${uniqueId}`,
    };
  }

  async generateValidJwt(
    userId: string,
    email: string,
    workspaceId?: string,
    roles: string[] = ['ROLE_USER'],
    expiresIn: number = 900
  ): Promise<string> {
    workspaceId = workspaceId ?? `workspace-${this.generateUniqueId()}`;
    
    const payload: JwtPayload = {
      sub: userId,
      email: email,
      workspace_id: workspaceId,
      workspaces: { [workspaceId]: roles },
      kimai_role: roles[0] ?? 'ROLE_USER',
    };

    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.jwtSecret);
    
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('proofa-identity')
      .setAudience('proofa-services')
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
      .sign(keyData);
  }

  async generateExpiredJwt(userId: string, email: string): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      email: email,
      kimai_role: 'ROLE_USER',
    };

    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.jwtSecret);
    
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setIssuer('proofa-identity')
      .setAudience('proofa-services')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(keyData);
  }

  generateRefreshToken(): string {
    return this.generateUniqueId();
  }

  private generateUniqueId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }
}
