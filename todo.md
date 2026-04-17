# TODO

## Logging

### Operations
- Add an info log in `apps/auth/src/auth.service.ts` for successful login.
  - Include: `userId`
  - Do not include: access token, refresh token, password

- Add an info log in `apps/auth/src/auth.service.ts` for successful refresh-token rotation.
  - Include: `userId`
  - Do not include: refresh token or token hash

- Add an info log in `apps/auth/src/auth.service.ts` for logout/session invalidation.
  - Include: `userId` when available
  - Keep logout idempotent and quiet on invalid tokens

### Debugging
- Add a warning log in `apps/auth/src/users/users.service.ts` for invalid login attempts.
  - Include: normalized email only
  - Do not distinguish between “user not found” and “wrong password” in the log message

- Add an error log in `libs/common/src/auth/jwt-auth.guard.ts` only for unexpected auth-service communication failures.
  - Use this for RMQ/auth infrastructure failures
  - Do not log bearer tokens or request headers

### Keep Out
- Do not log passwords
- Do not log access tokens
- Do not log refresh tokens
- Do not log refresh token hashes
- Do not log raw `Authorization` headers
- Do not log every successful guarded request
