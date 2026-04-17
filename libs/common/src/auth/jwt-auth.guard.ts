import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, map, Observable, tap } from 'rxjs';
import { AUTH_SERVICE } from './services';

type AuthenticatedUser = Record<string, unknown>;

interface RpcAuthPayload {
  Authorization?: string;
  user?: AuthenticatedUser;
}

interface HttpAuthRequest {
  headers?: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AUTH_SERVICE) private authClient: ClientProxy) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const authorization = this.getAuthorization(context);

    // Forward the bearer token to the auth service for centralized JWT validation.
    return this.authClient
      .send<AuthenticatedUser, RpcAuthPayload>('validate_user', {
        Authorization: authorization,
      })
      .pipe(
        // Attach the validated user to the current request/message payload so
        // downstream handlers can access it without parsing the token again.
        tap({
          next: (user) => {
            this.addUser(user, context);
          },
        }),
        map(() => true),
        catchError(() => {
          throw new UnauthorizedException();
        }),
      );
  }

  private getAuthorization(context: ExecutionContext) {
    let authorization: string | undefined;

    if (context.getType() === 'rpc') {
      const rpcData = context.switchToRpc().getData<RpcAuthPayload>();
      authorization = rpcData.Authorization;
    } else if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<HttpAuthRequest>();
      authorization = request.headers?.authorization;
    }

    if (!authorization) {
      throw new UnauthorizedException(
        'No value was provided for Authorization',
      );
    }

    return authorization;
  }

  private addUser(user: AuthenticatedUser, context: ExecutionContext) {
    if (context.getType() === 'rpc') {
      const rpcData = context.switchToRpc().getData<RpcAuthPayload>();
      rpcData.user = user;
    } else if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<HttpAuthRequest>();
      request.user = user;
    }
  }
}
