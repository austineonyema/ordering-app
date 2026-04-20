# Production Logging Policy

## Goal

Keep logs useful for:

- operations
- incident response
- security review
- debugging real failures

Do not log just because it is technically possible.

## Log In Production

### HTTP / Request Lifecycle

- automatic request completion logs from `nestjs-pino`
- include:
  - `req.id`
  - `service`
  - `environment`
  - `method`
  - `url`
  - `statusCode`
  - `responseTime`

### Auth

- successful login
  - include:
    - `userId`
- successful refresh-token rotation
  - include:
    - `userId`
- successful logout / session invalidation
  - include:
    - `userId` when available
- invalid refresh-token attempts
  - log only if it helps security or abuse monitoring
  - include:
    - `userId` only if already safely known

### Orders

- successful order creation
  - include:
    - `userId`
    - `orderId`
- failed order creation
  - include:
    - `userId` when available
    - error details through normal exception logging

### Billing / RMQ

- received important domain event
  - include:
    - `pattern`
    - `service`
- successful ack only if event volume stays reasonable
- failed processing / nack / retry-worthy failure
  - include:
    - `pattern`
    - `service`
    - correlation/request id if available

### Shared Infra

- unexpected auth-service delegation failures in `JwtAuthGuard`
- unexpected repository/database failures
- startup / bootstrap failures
- RMQ connection failures and reconnect issues

## Development-Only Or Debug-Only Logs

These are allowed in local development, but should usually be reduced or removed in production:

- highly chatty lifecycle logs
- detailed repository miss logs
- temporary investigation logs
- verbose RMQ connect/disconnect chatter
- request/handler tracing that fires on every normal successful call

## Never Log

- passwords
- access tokens
- refresh tokens
- refresh-token hashes
- raw `Authorization` headers
- full auth payloads
- full request bodies unless carefully sanitized
- secrets from env/config

## Recommended Structured Fields

- `service`
- `environment`
- `req.id`
- `userId`
- `orderId`
- `pattern`
- `statusCode`
- `responseTime`

## Environment Rule

1. Prefer logger level first
   - use `debug` / `verbose` for development-only logs
   - keep production at `info` and above

2. Use explicit environment checks only for truly exceptional cases
   - example:
     - temporary investigation logs
     - local-only payload inspection

3. Keep the rule centralized when possible
   - request logging shape and redaction belong in shared logger config
   - business-event decisions belong in services

## Practical Rule Of Thumb

- `log()`:
  - meaningful business success
- `warn()`:
  - suspicious, degraded, or client-caused problem
- `error()`:
  - failure that needs attention
- `debug()` / `verbose()`:
  - local/dev or temporary investigation
