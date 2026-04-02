import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

@Injectable()
export class JwtService {
  private readonly secretKey: Uint8Array;

  constructor() {
    const secret = process.env.AFFINE_JWT_SECRET || 'default_secret_key_for_development_only';
    this.secretKey = new TextEncoder().encode(secret);
  }

  async sign(payload: JWTPayload): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('proofa-identity')
      .setAudience('proofa-services')
      .setExpirationTime('15m')
      .sign(this.secretKey);
  }

  async verify(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.secretKey, {
      issuer: 'proofa-identity',
      audience: 'proofa-services',
    });
    return payload;
  }
}
