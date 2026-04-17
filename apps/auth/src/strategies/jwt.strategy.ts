import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, TokenPayload } from '../auth.service';

interface AuthenticatedRequest {
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

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request?: AuthenticatedRequest) => {
          return getTokenFromAuthorizationValue(request?.Authorization);
        },
      ]),
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate({ userId }: TokenPayload) {
    try {
      return await this.authService.validateUser(userId);
    } catch {
      throw new UnauthorizedException();
    }
  }
}
