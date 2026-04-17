import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RmqContext, RmqOptions, Transport } from '@nestjs/microservices';

interface RmqAckChannel {
  ack(message: Record<string, unknown>): void;
}

@Injectable()
export class RmqService {
  constructor(private readonly configService: ConfigService) {}

  getOptions(queue: string, noAck = false): RmqOptions {
    return {
      transport: Transport.RMQ,
      options: {
        urls: [this.configService.getOrThrow<string>('RABBIT_MQ_URI')],
        queue: this.configService.getOrThrow<string>(
          `RABBIT_MQ_${queue}_QUEUE`,
        ),
        noAck,
        persistent: true,
      },
    };
  }

  ack(context: RmqContext) {
    const { channel, message } = this.getAcknowledgementContext(context);
    channel.ack(message);
  }

  private getAcknowledgementContext(context: RmqContext) {
    const channel = context.getChannelRef() as RmqAckChannel;
    const message = context.getMessage() as Record<string, unknown>;

    return {
      channel,
      message,
    };
  }
}
