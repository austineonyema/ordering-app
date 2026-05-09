# Ordering App

`ordering-app` is a NestJS monorepo with three services:

- `auth`: owns user auth, token issuance, refresh-token rotation, and session invalidation
- `orders`: exposes authenticated HTTP order routes and emits internal billing events
- `billing`: consumes trusted RabbitMQ events and performs billing work

The project uses:

- HTTP for client-facing routes
- RabbitMQ for internal async messaging
- MongoDB for persistence
- `libs/common` for shared auth, logging, RMQ, and database primitives

## Core Idea

The current architecture is built around this separation:

- `auth` issues access tokens
- other services verify access tokens locally
- internal domain events carry business data, not bearer tokens

That means `orders` and `billing` no longer make a per-request network call back to `auth` just to authorize a request.

## Current Auth Model

This is the most important architectural change in the codebase.

### Access tokens

Access tokens are:

- signed in `auth`
- signed with `AUTH_JWT_PRIVATE_KEY`
- signed with `RS256`
- verified locally in other services with `AUTH_JWT_PUBLIC_KEY`

Code anchors:

- signing: [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
- shared verifier module: [auth.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/auth.module.ts)
- shared local guard: [jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)

This is the relevant shape in `auth`:

```ts
const accessToken = this.jwtService.sign(accessTokenPayload, {
  privateKey: this.configService.getOrThrow<string>('AUTH_JWT_PRIVATE_KEY'),
  algorithm: 'RS256',
});
```

And this is the relevant shape in shared verification:

```ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    publicKey: configService.getOrThrow<string>('AUTH_JWT_PUBLIC_KEY'),
    verifyOptions: {
      algorithms: ['RS256'],
    },
  }),
})
```

### Refresh tokens

Refresh tokens are still auth-owned and intentionally separate.

They are:

- created only in `auth`
- verified only in `auth`
- signed with `JWT_REFRESH_SECRET`
- rotated during refresh
- checked against the stored hashed refresh session in Mongo

This means:

- access-token verification is decentralized
- refresh/session control stays centralized in `auth`

That is a good split.

### Token purpose

Tokens include an explicit `type` claim:

- `access`
- `refresh`

The shared guard only accepts `type === 'access'`.
The refresh/logout flow only accepts `type === 'refresh'`.

Code anchors:

- shared claims: [auth.types.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/auth.types.ts)
- refresh/logout checks: [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

## Mental Model

If you are tracing the code, the simplest map is:

`controller -> guard -> service -> repository or RMQ client -> shared infra`

Use that as your default traversal rule.

For this repo specifically:

- controllers define transport boundaries
- guards decide whether a request is trusted
- services orchestrate use cases
- repositories talk to Mongo
- RMQ clients emit internal events
- `libs/common` supplies shared building blocks

## Service Map

### 1. Auth

`auth` is responsible for identity and session lifecycle.

It currently:

- creates users
- logs users in
- signs access tokens
- signs and rotates refresh tokens
- logs users out by clearing the stored refresh session

Important files:

- [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
- [users.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.controller.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)
- [local-strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/local-strategy.ts)

Important note:

- `auth` still boots an RMQ microservice in [main.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/main.ts)
- but current authorization for `orders` and `billing` no longer depends on auth-over-RMQ

So auth is no longer on the hot path of every protected request.

### 2. Orders

`orders` is the HTTP-facing business service.

It:

- protects its routes with the shared local JWT guard
- reads trusted user claims from `@CurrentUser()`
- stores orders in Mongo
- emits `order_created` to billing

Important files:

- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
- [orders.repository.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.repository.ts)
- [orders.module.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.module.ts)

### 3. Billing

`billing` is currently event-driven.

It:

- listens for `order_created`
- trusts the event emitted by `orders`
- performs billing work
- acknowledges the RMQ message

Important files:

- [billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)
- [billing.service.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.service.ts)
- [main.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/main.ts)

## Shared Auth Flow

The shared auth layer lives in `libs/common/src/auth`.

Key files:

- [auth.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/auth.module.ts)
- [jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
- [current-user.decorator.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/current-user.decorator.ts)
- [auth.types.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/auth.types.ts)

### What the shared guard does

The shared `JwtAuthGuard`:

1. reads `Authorization`
2. extracts the bearer token
3. verifies it locally with the shared `JwtModule`
4. checks that `type === 'access'`
5. attaches user claims to the request or RPC payload

Those claims currently look like:

```ts
type AccessTokenClaims = {
  userId: string;
  email: string;
  type: 'access';
};
```

That is intentionally lean.

It means downstream services authorize based on token claims, not by fetching a full user document on every request.

## HTTP Routes

### Auth routes

From [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts) and [users.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.controller.ts):

- `POST /auth/users`
  - creates a new user
- `POST /auth/login`
  - uses `LocalAuthGuard`
  - validates email and password
  - returns `user`, `accessToken`, `refreshToken`
- `POST /auth/refresh`
  - verifies refresh token
  - checks stored refresh session
  - returns a fresh token pair
- `POST /auth/logout`
  - clears the stored refresh session

### Orders routes

From [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts):

- `GET /orders`
  - protected
  - returns all orders
- `GET /orders/self`
  - protected
  - returns orders belonging to the authenticated user
- `GET /orders/:id`
  - protected
  - returns orders for the provided user id
- `POST /orders`
  - protected
  - creates an order for the authenticated user

Important detail:

`POST /orders` does not trust a client-supplied `userId` in the request body.
It gets ownership from:

- `@CurrentUser()`
- specifically `user.userId`

That is the right shape for an authenticated write flow.

## RMQ Events

### `order_created`

Defined by:

- [order-created.event.ts](/home/techrhythm/dev/ordering-app/libs/common/src/events/order-created.event.ts)

Current contract:

```ts
export interface OrderCreatedEvent {
  request: OrderRequestDto;
  userId: string;
}
```

This is an important improvement.

The internal event now carries:

- order request data
- `userId`

It does not carry:

- `Authorization`
- bearer tokens

That keeps internal service communication cleaner and less tightly coupled to edge-auth concerns.

## End-to-End Flows

### 1. User signup

`POST /auth/users`

Flow:

- [users.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.controller.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)
- [user.schema.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/schemas/user.schema.ts)

What happens:

- request is validated
- email is normalized and checked for duplicates
- user is created
- password hashing happens at the model layer
- public-safe user data is returned

### 2. User login

`POST /auth/login`

Flow:

- [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [local-auth.guard.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/guards/local-auth.guard.ts)
- [local-strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/local-strategy.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

What happens:

- local strategy validates credentials
- auth builds `access` and `refresh` payloads
- access token is signed with private key + RS256
- refresh token is generated with refresh secret
- hashed refresh token is stored for the user

### 3. Protected orders request

Example:

`GET /orders/self`

Flow:

- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
- [current-user.decorator.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/current-user.decorator.ts)
- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)

What happens:

- `orders` receives `Authorization: Bearer <token>`
- shared guard verifies the token locally
- guard attaches claims to the request
- controller reads `user.userId` from `@CurrentUser()`
- service queries Mongo with that user id

No auth-service network call is needed.

### 4. Protected order creation

`POST /orders`

Flow:

- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
- [orders.repository.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.repository.ts)
- [billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)

What happens:

- shared guard verifies access token locally
- controller gets trusted `user.userId`
- service starts a transaction
- order is persisted with that `userId`
- `orders` emits `order_created`
- `billing` consumes the event and acknowledges it

### 5. Refresh flow

`POST /auth/refresh`

Flow:

- [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)

What happens:

- auth verifies refresh token with `JWT_REFRESH_SECRET`
- auth checks `type === 'refresh'`
- auth loads the user refresh session
- auth compares the presented token to the stored hashed refresh token
- if valid, auth rotates the refresh token and returns a new token pair

## Why This Design Is Better

Compared to the older centralized validation approach, the current design:

- removes a per-request network hop to `auth`
- reduces runtime coupling between services
- avoids making `orders` and `billing` depend on auth availability for normal access-token verification
- keeps refresh/session control safely centralized
- stops passing bearer tokens around in internal domain events

That is a much healthier microservice boundary.

## Shared `common` Library

`libs/common` is the infrastructure layer of the monorepo.

The most important directories are:

- [libs/common/src/auth](/home/techrhythm/dev/ordering-app/libs/common/src/auth)
- [libs/common/src/rmq](/home/techrhythm/dev/ordering-app/libs/common/src/rmq)
- [libs/common/src/database](/home/techrhythm/dev/ordering-app/libs/common/src/database)
- [libs/common/src/logging](/home/techrhythm/dev/ordering-app/libs/common/src/logging)

Key exports from [index.ts](/home/techrhythm/dev/ordering-app/libs/common/src/index.ts):

- shared auth module and guard
- shared current-user decorator
- RMQ module and service
- database module and abstract repository
- shared DTOs and event contracts
- shared logging module

## Logging

The repo now uses shared `nestjs-pino` logging from `libs/common`.

Important files:

- [logging.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/logging/logging.module.ts)
- [auth/main.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/main.ts)
- [orders/main.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/main.ts)
- [billing/main.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/main.ts)

Current behavior:

- pretty logs in development
- JSON logs in production
- request ids are generated or reused from `x-request-id`
- sensitive fields are redacted
- all apps use `LoggerErrorInterceptor`

## How to Navigate the Codebase

The easiest way to move through this repo is to choose the entry point based on the question you are asking.

### If the question is about authenticated request flow

Start at:

- [jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)

Then move to:

- [current-user.decorator.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/current-user.decorator.ts)
- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)

### If the question is about token issuance

Start at:

- [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

Then inspect:

- [local-strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/local-strategy.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)

### If the question is about refresh/logout behavior

Start at:

- [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

Then inspect:

- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)
- [user.schema.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/schemas/user.schema.ts)

### If the question is about order ownership

Start at:

- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)

Then inspect:

- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
- [order.schema.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/schemas/order.schema.ts)

### If the question is about internal messaging

Start at:

- [order-created.event.ts](/home/techrhythm/dev/ordering-app/libs/common/src/events/order-created.event.ts)
- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
- [billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)

### If the question is about Mongo access

Start at:

- [abstract.repository.ts](/home/techrhythm/dev/ordering-app/libs/common/src/database/abstract.repository.ts)
- [database.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/database/database.module.ts)

Then jump into the app-specific repository:

- [users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)
- [orders.repository.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.repository.ts)

## Local Development

Install dependencies:

```bash
pnpm install
```

Build individual services:

```bash
pnpm run build:auth
pnpm run build:orders
pnpm run build:billing
```

Build everything:

```bash
pnpm run build:all
```

Run a service directly:

```bash
pnpm exec nest start auth --watch
pnpm exec nest start orders --watch
pnpm exec nest start billing --watch
```

## Docker

The project includes:

- MongoDB replica set
- RabbitMQ with management UI
- `auth`
- `orders`
- `billing`

Start everything:

```bash
docker compose up --build
```

Notes:

- root [`.env`](/home/techrhythm/dev/ordering-app/.env) is used for Compose interpolation
- service-level env files such as [apps/auth/.env](/home/techrhythm/dev/ordering-app/apps/auth/.env) and [apps/auth/.env.docker](/home/techrhythm/dev/ordering-app/apps/auth/.env.docker) are used inside containers at runtime
- `auth` and `orders` expose HTTP ports
- `billing` currently runs only as an RMQ microservice

## Best Reading Order

If you want to understand the current architecture quickly, this order works well:

1. [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
2. [libs/common/src/auth/auth.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/auth.module.ts)
3. [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
4. [apps/orders/src/orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
5. [apps/orders/src/orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
6. [libs/common/src/events/order-created.event.ts](/home/techrhythm/dev/ordering-app/libs/common/src/events/order-created.event.ts)
7. [apps/billing/src/billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)

That path teaches:

- token issuance
- local token verification
- authenticated HTTP access
- ownership derivation from claims
- internal event emission
- trusted internal event consumption

## Quick Verification Summary

As of the current code:

- access tokens are signed with private key + `RS256`
- shared services verify access tokens with public key + `RS256`
- refresh tokens remain secret-based and auth-owned
- `orders` no longer calls auth to validate each protected request
- `billing` no longer re-verifies the original caller token for `order_created`
- internal events now pass `userId`, not `Authorization`

That means the codebase is now aligned with the architectural goal of local verification and looser service coupling.
