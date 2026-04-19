import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { AuthService, TokenPayload } from '../auth.service';

interface AuthenticatedRequest {
  headers?: {
    authorization?: string;
  };
  Authorization?: string;
}

function getTokenFromAuthorizationValue(value?: string) {
  if (!value) {
    return null;
  }

  if (value.startsWith('Bearer ')) {
    return value.slice(7);
  }

  return value;
}

function extractToken(request?: AuthenticatedRequest) {
  const authorizationHeader = request?.headers?.authorization;

  return (
    getTokenFromAuthorizationValue(authorizationHeader) ??
    getTokenFromAuthorizationValue(request?.Authorization)
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: extractToken,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate({ userId, type }: TokenPayload) {
    if (type !== 'access') {
      throw new UnauthorizedException();
    }

    try {
      return await this.authService.validateUser(userId);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
