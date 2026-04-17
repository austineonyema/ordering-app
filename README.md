# Ordering App

`ordering-app` is a NestJS monorepo with three services:

- `auth`: owns user auth, token issuance, token refresh, and centralized JWT validation
- `orders`: exposes HTTP order routes and emits billing events
- `billing`: consumes RabbitMQ events and processes billing work

The project uses:

- HTTP for client-facing routes
- RabbitMQ for service-to-service communication
- MongoDB for persistence
- a shared `common` library for auth guards, RMQ setup, and database primitives

## Mental Model

Think of the project in layers:

1. Route boundary
   - Controllers receive HTTP requests or RMQ messages.
2. Use-case layer
   - Services decide what the app should do.
3. Persistence/integration layer
   - Repositories talk to Mongo.
   - RMQ clients publish to other services.
4. Shared infrastructure
   - `libs/common` provides shared auth, RMQ, and database building blocks.

If you are ever lost, start from the controller method that handles the request, then move inward:

`controller -> service -> repository or RMQ client -> shared infra`

## Service Map

### 1. Auth

Auth is the trust service for the whole system.

It does two jobs at once:

- runs as a normal HTTP app
- runs as an RMQ microservice

That happens in [apps/auth/src/main.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/main.ts):

- `NestFactory.create(AuthModule)` starts the HTTP app
- `connectMicroservice(...)` attaches the RMQ transport
- `startAllMicroservices()` starts the RMQ listener
- `listen(...)` starts the HTTP server

Important files:

- [apps/auth/src/auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
- [apps/auth/src/strategies/local-strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/local-strategy.ts)
- [apps/auth/src/strategies/jwt.strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/jwt.strategy.ts)
- [apps/auth/src/users/users.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.controller.ts)
- [apps/auth/src/users/users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [apps/auth/src/users/users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)

### 2. Orders

Orders is the HTTP-facing order service.

It:

- accepts authenticated order requests
- stores orders in Mongo
- emits `order_created` to billing over RabbitMQ

Important files:

- [apps/orders/src/orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [apps/orders/src/orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
- [apps/orders/src/orders.repository.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.repository.ts)
- [apps/orders/src/orders.module.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.module.ts)

### 3. Billing

Billing is currently RMQ-first.

It:

- listens for `order_created`
- validates the forwarded caller token through auth
- performs billing work
- acknowledges the RMQ message

Important files:

- [apps/billing/src/billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)
- [apps/billing/src/billing.service.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.service.ts)
- [apps/billing/src/main.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/main.ts)

## Route and Message Map

### Auth HTTP routes

From [apps/auth/src/auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts):

- `POST /auth/users`
  - create a new user
  - entry point: [users.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.controller.ts)
- `POST /auth/login`
  - uses `LocalAuthGuard`
  - validates email/password
  - returns `accessToken` and `refreshToken`
- `POST /auth/refresh`
  - verifies refresh token
  - rotates refresh token
  - returns a new token pair
- `POST /auth/logout`
  - clears the stored refresh session

### Auth RMQ route

From [apps/auth/src/auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts):

- `validate_user`
  - RMQ message pattern
  - protected by auth's local JWT guard
  - returns the current validated user

This is the route other services rely on for centralized JWT validation.

### Orders HTTP routes

From [apps/orders/src/orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts):

- `GET /orders`
  - fetches orders
- `POST /orders`
  - protected by the shared JWT guard from `libs/common`
  - creates the order
  - forwards the caller's `Authorization` value to billing

### Billing RMQ route

From [apps/billing/src/billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts):

- `order_created`
  - RMQ event pattern
  - protected by the shared JWT guard from `libs/common`
  - bills the order
  - acknowledges the RMQ message

## How the Services Connect

### Flow 1: User signup

`POST /auth/users`

Code path:

- [users.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.controller.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)
- [user.schema.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/schemas/user.schema.ts)

What happens:

- email is normalized
- duplicate email is checked
- user is created
- password hashing happens at the schema level
- a public-safe user shape is returned

### Flow 2: User login

`POST /auth/login`

Code path:

- [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [local-auth.guard.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/guards/local-auth.guard.ts)
- [local-strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/local-strategy.ts)
- [users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

What happens:

- `LocalAuthGuard` triggers the local strategy
- local strategy validates email and password
- auth service signs:
  - `accessToken`
  - `refreshToken`
- refresh token is persisted through the user layer

### Flow 3: Protected order creation

`POST /orders`

Code path:

- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
- [apps/auth/src/auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [apps/auth/src/strategies/jwt.strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/jwt.strategy.ts)
- [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
- [apps/orders/src/orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)

What happens:

- orders receives `Authorization: Bearer <token>`
- shared JWT guard does not validate the token locally
- instead, it forwards the token to auth via `validate_user`
- auth validates the token and returns the user
- orders creates the order in Mongo
- orders emits `order_created` to billing and includes the same `Authorization` value in the event payload

### Flow 4: Billing after order creation

`order_created` event

Code path:

- [billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)
- [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
- [auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [billing.service.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.service.ts)
- [libs/common/src/rmq/rmq.service.ts](/home/techrhythm/dev/ordering-app/libs/common/src/rmq/rmq.service.ts)

What happens:

- billing receives the RMQ event
- shared JWT guard reads `Authorization` from the event payload
- billing asks auth to validate the token
- if valid, billing proceeds
- billing acks the RMQ message after successful processing

## Two JWT Guards: Why Both Exist

This is one of the most important things to understand in the repo.

### Auth app JWT guard

File:

- [apps/auth/src/guards/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/guards/jwt-auth.guard.ts)

Purpose:

- used only inside the auth service
- wraps Passport's local JWT strategy
- validates JWTs directly inside auth

Use it when auth itself needs to validate a token.

### Shared/common JWT guard

File:

- [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)

Purpose:

- used by `orders` and `billing`
- does not validate the JWT locally
- forwards the token to auth over RabbitMQ

Use it when another service wants auth to remain the single source of JWT validation truth.

Short version:

- auth guard in `auth` = local token validation
- shared guard in `common` = delegated token validation

## How to Navigate the Codebase

The easiest way to move through this repo is to choose the entry point based on the question you are asking.

### If the question is about an HTTP route

Start at:

- controller

Then move to:

- service
- repository or external integration

Example:

`POST /orders`

Traversal:

- [orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
- [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
- [orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
- [orders.repository.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.repository.ts)

### If the question is about token validation

Start at:

- [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)

Then jump to:

- [apps/auth/src/auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
- [apps/auth/src/guards/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/guards/jwt-auth.guard.ts)
- [apps/auth/src/strategies/jwt.strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/jwt.strategy.ts)
- [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

### If the question is about password or refresh-token handling

Start at:

- [apps/auth/src/users/schemas/user.schema.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/schemas/user.schema.ts)

Then inspect:

- [apps/auth/src/users/users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

Reason:

- schema middleware now owns hashing
- auth service owns token orchestration

### If the question is about user shape or safe returns

Start at:

- [apps/auth/src/users/users.types.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.types.ts)

Then inspect:

- [apps/auth/src/users/users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
- [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)

Reason:

- `PublicUser`
- `UserWithPassword`
- `RefreshUserRecord`

These types explain why some paths can see password or refresh hash while public-facing paths cannot.

### If the question is about RabbitMQ setup

Start at:

- [libs/common/src/rmq/rmq.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/rmq/rmq.module.ts)
- [libs/common/src/rmq/rmq.service.ts](/home/techrhythm/dev/ordering-app/libs/common/src/rmq/rmq.service.ts)

Then check:

- [apps/auth/src/main.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/main.ts)
- [apps/billing/src/main.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/main.ts)
- [apps/orders/src/orders.module.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.module.ts)

Mental shortcut:

- plain `RmqModule` = consumer/server helper
- `RmqModule.register({ name })` = producer/client proxy

### If the question is about Mongo access

Start at:

- [libs/common/src/database/abstract.repository.ts](/home/techrhythm/dev/ordering-app/libs/common/src/database/abstract.repository.ts)
- [libs/common/src/database/database.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/database/database.module.ts)

Then jump into the app-specific repository:

- [apps/auth/src/users/users.repository.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.repository.ts)
- [apps/orders/src/orders.repository.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.repository.ts)

## Shared `common` Library

`libs/common` is not just utilities. It is the project's infrastructure layer.

Key exports from [libs/common/src/index.ts](/home/techrhythm/dev/ordering-app/libs/common/src/index.ts):

- shared auth module
- shared JWT guard
- RMQ module and service
- database module and abstract repository
- shared DTOs and event contracts

The most important directories are:

- [libs/common/src/auth](/home/techrhythm/dev/ordering-app/libs/common/src/auth)
- [libs/common/src/rmq](/home/techrhythm/dev/ordering-app/libs/common/src/rmq)
- [libs/common/src/database](/home/techrhythm/dev/ordering-app/libs/common/src/database)

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

Run a service directly with Nest CLI:

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

## Recommended Reading Order

If you are onboarding into this repo, this order works well:

1. [apps/orders/src/orders.controller.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.controller.ts)
2. [libs/common/src/auth/jwt-auth.guard.ts](/home/techrhythm/dev/ordering-app/libs/common/src/auth/jwt-auth.guard.ts)
3. [apps/auth/src/auth.controller.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.controller.ts)
4. [apps/auth/src/strategies/jwt.strategy.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/strategies/jwt.strategy.ts)
5. [apps/auth/src/auth.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/auth.service.ts)
6. [apps/auth/src/users/users.service.ts](/home/techrhythm/dev/ordering-app/apps/auth/src/users/users.service.ts)
7. [apps/orders/src/orders.service.ts](/home/techrhythm/dev/ordering-app/apps/orders/src/orders.service.ts)
8. [apps/billing/src/billing.controller.ts](/home/techrhythm/dev/ordering-app/apps/billing/src/billing.controller.ts)
9. [libs/common/src/rmq/rmq.module.ts](/home/techrhythm/dev/ordering-app/libs/common/src/rmq/rmq.module.ts)
10. [libs/common/src/database/abstract.repository.ts](/home/techrhythm/dev/ordering-app/libs/common/src/database/abstract.repository.ts)

That reading path teaches:

- route entry
- auth delegation
- token validation
- user lookup
- service-to-service handoff
- RMQ and database infrastructure

## Current Architectural Shape

In one sentence:

`auth` owns identity, `orders` owns order creation, `billing` owns billing side effects, and `common` holds the infrastructure that lets those services talk cleanly.
