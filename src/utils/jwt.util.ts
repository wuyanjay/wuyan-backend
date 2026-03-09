import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors/custom-errors';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;        // user id
  email: string;
  roles: string[];
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}

export class JwtUtil {
  private static ACCESS_SECRET = env.JWT_SECRET;
  private static ACCESS_EXPIRY = env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'];
  
  static generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.ACCESS_SECRET, {
      expiresIn: this.ACCESS_EXPIRY,
      issuer: 'auth-service',
      audience: 'api'
    });
  }
  
  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.ACCESS_SECRET, {
        issuer: 'auth-service',
        audience: 'api'
      }) as AccessTokenPayload;
      
      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('访问令牌已过期', 'ACCESS_TOKEN_EXPIRED');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('访问令牌无效', 'INVALID_ACCESS_TOKEN');
      }
      throw new UnauthorizedError('访问令牌无效或已过期', 'INVALID_ACCESS_TOKEN');
    }
  }
  
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }
}
