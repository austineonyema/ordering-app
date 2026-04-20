import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type LoggingModuleOptions = {
  serviceName: string;
};

const REDACTED_LOG_PATHS = [
  'req.headers.authorization',
  'req.body.password',
  'req.body.refreshToken',
  'req.body.accessToken',
  'req.body.Authorization',
];

const AUTO_LOGGING_IGNORED_PATHS = new Set([
  '/favicon.ico',
  '/health',
  '/metrics',
]);

type HttpLogRequest = {
  id?: string | number;
  method?: string;
  url?: string;
  params?: unknown;
  query?: unknown;
  remoteAddress?: string;
  remotePort?: number;
  headers?: {
    'x-request-id'?: string | string[];
  };
};

type HttpLogRequestMessage = IncomingMessage & HttpLogRequest;

type HttpLogResponse = ServerResponse<IncomingMessage> & {
  statusCode?: number;
  setHeader(name: string, value: string): void;
};

type HttpLogError = Error & {
  statusCode?: number;
};

@Module({
  exports: [LoggerModule],
})
export class LoggingModule {
  static register({ serviceName }: LoggingModuleOptions): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        ConfigModule,
        LoggerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const nodeEnv =
              configService.get<string>('NODE_ENV') ?? 'development';
            const isProduction = nodeEnv === 'production';

            return {
              pinoHttp: {
                level: isProduction ? 'info' : 'debug',
                autoLogging: {
                  ignore: (req: IncomingMessage) =>
                    AUTO_LOGGING_IGNORED_PATHS.has(req.url ?? ''),
                },
                genReqId: (req, res) => {
                  const headerRequestId = req.headers['x-request-id'];
                  const requestId = Array.isArray(headerRequestId)
                    ? headerRequestId[0]
                    : (headerRequestId ?? randomUUID());

                  res.setHeader('x-request-id', requestId);
                  return requestId;
                },
                customProps: () => ({
                  service: serviceName,
                  environment: nodeEnv,
                }),
                customLogLevel: (
                  _req: IncomingMessage,
                  res: HttpLogResponse,
                  err?: HttpLogError,
                ) => {
                  if (err || (res.statusCode ?? 200) >= 500) {
                    return 'error';
                  }

                  if ((res.statusCode ?? 200) >= 400) {
                    return 'warn';
                  }

                  return 'info';
                },
                customSuccessMessage: () => 'request completed',
                customErrorMessage: () => 'request errored',
                serializers: {
                  req: (req: HttpLogRequestMessage) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                    params: req.params,
                    query: req.query,
                    remoteAddress: req.remoteAddress,
                    remotePort: req.remotePort,
                  }),
                  res: (res: HttpLogResponse) => ({
                    statusCode: res.statusCode,
                  }),
                  err: (err: HttpLogError) => ({
                    type: err.name,
                    message: err.message,
                    statusCode: err.statusCode,
                    stack: err.stack,
                  }),
                },
                redact: {
                  paths: REDACTED_LOG_PATHS,
                  remove: true,
                },
                ...(isProduction
                  ? {}
                  : {
                      transport: {
                        target: 'pino-pretty',
                        options: {
                          colorize: true,
                          singleLine: true,
                          translateTime: 'SYS:standard',
                        },
                      },
                    }),
              },
            };
          },
        }),
      ],
      exports: [LoggerModule],
    };
  }
}
