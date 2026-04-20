import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type AuthenticatedUser = Record<string, unknown>;

export const getCurrentUserByContext = (
  context: ExecutionContext,
): AuthenticatedUser => {
  if (context.getType() === 'http') {
    return context.switchToHttp().getRequest().user;
  }

  if (context.getType() === 'rpc') {
    return context.switchToRpc().getData().user;
  }

  throw new Error('Unsupported execution context');
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    getCurrentUserByContext(context),
);
