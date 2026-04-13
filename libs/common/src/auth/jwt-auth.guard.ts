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
  Authentication?: string;
  user?: AuthenticatedUser;
}

interface HttpAuthRequest {
  cookies?: {
    Authentication?: string;
  };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AUTH_SERVICE) private authClient: ClientProxy) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const authentication = this.getAuthentication(context);

    // Forward the token to the auth service for centralized JWT validation.
    return this.authClient
      .send<AuthenticatedUser, RpcAuthPayload>('validate_user', {
        Authentication: authentication,
      })
      .pipe(
        // Attach the validated user to the current request/message payload so
        // downstream handlers can access it without parsing the token again.
        tap((user) => {
          this.addUser(user, context);
        }),
        map(() => true),
        catchError(() => {
          throw new UnauthorizedException();
        }),
      );
  }

  private getAuthentication(context: ExecutionContext) {
    let authentication: string | undefined;

    if (context.getType() === 'rpc') {
      const rpcData = context.switchToRpc().getData<RpcAuthPayload>();
      authentication = rpcData.Authentication;
    } else if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<HttpAuthRequest>();
      authentication = request.cookies?.Authentication;
    }

    if (!authentication) {
      throw new UnauthorizedException(
        'No value was provided for Authentication',
      );
    }

    return authentication;
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
