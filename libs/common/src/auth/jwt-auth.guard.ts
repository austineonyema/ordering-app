import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AccessTokenClaims } from './auth.types';

interface HttpAuthRequest {
  headers?: {
    authorization?: string;
  };
  user?: AccessTokenClaims;
}

interface RpcAuthPayload {
  Authorization?: string;
  user?: AccessTokenClaims;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authorization = this.getAuthorization(context);
    const token = this.extractBearerToken(authorization);

    let payload: AccessTokenClaims;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    this.attachUser(payload, context);
    return true;
  }

  private getAuthorization(context: ExecutionContext): string {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<HttpAuthRequest>();
      const authorization = request.headers?.authorization;
      if (!authorization) {
        throw new UnauthorizedException('Authorization header missing');
      }
      return authorization;
    }

    if (context.getType() === 'rpc') {
      const data = context.switchToRpc().getData<RpcAuthPayload>();
      const authorization = data.Authorization;
      if (!authorization) {
        throw new UnauthorizedException('Authorization value missing');
      }
      return authorization;
    }

    throw new UnauthorizedException('Unsupported execution context');
  }

  private extractBearerToken(authorization: string): string {
    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    return authorization.slice(7);
  }

  private attachUser(payload: AccessTokenClaims, context: ExecutionContext) {
    const user = {
      userId: payload.userId,
      email: payload.email,
      type: payload.type,
    };

    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<HttpAuthRequest>();
      request.user = user as AccessTokenClaims;
      return;
    }

    if (context.getType() === 'rpc') {
      const data = context.switchToRpc().getData<RpcAuthPayload>();
      data.user = user as AccessTokenClaims;
    }
  }
}
