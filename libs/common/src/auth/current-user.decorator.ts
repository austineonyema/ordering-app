import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { type AccessTokenClaims } from './auth.types';

type AuthenticatedContext = {
  user?: AccessTokenClaims;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenClaims => {
    if (context.getType() === 'http') {
      return context.switchToHttp().getRequest<AuthenticatedContext>().user!;
    }

    if (context.getType() === 'rpc') {
      return context.switchToRpc().getData<AuthenticatedContext>().user!;
    }

    throw new Error('Unsupported execution context');
  },
);
