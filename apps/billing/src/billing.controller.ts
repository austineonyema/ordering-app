import { Controller, Get } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { OrderCreatedEvent } from '@app/common';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  getHello(): string {
    return this.billingService.getHello();
  }

  @EventPattern('order_created')
  handleOrderCreated(
    @Payload() data: OrderCreatedEvent,
    @Ctx() context: RmqContext,
  ) {
    this.billingService.bill(data);
  }
}

// interface RmqAckChannel {
//   ack(message: Record<string, unknown>): void;
//   nack(
//     message: Record<string, unknown>,
//     allUpTo?: boolean,
//     requeue?: boolean,
//   ): void;
// }

// function isRmqAckChannel(value: unknown): value is RmqAckChannel {
//   return (
//     typeof value === 'object' &&
//     value !== null &&
//     'ack' in value &&
//     typeof value.ack === 'function' &&
//     'nack' in value &&
//     typeof value.nack === 'function'
//   );
// }

//   @EventPattern('order_created')
//   handleOrderCreated(
//     @Payload() data: OrderCreatedEvent,
//     @Ctx() context: RmqContext,
//   ) {
//     const channelRef: unknown = context.getChannelRef();
//     if (!isRmqAckChannel(channelRef)) {
//       throw new Error('Invalid RabbitMQ channel reference');
//     }

//     const channel = channelRef;
//     const message = context.getMessage();

//     try {
//       this.billingService.bill(data);
//       channel.ack(message);
//     } catch (error) {
//       channel.nack(message, false, false);
//       throw error;
//     }
//   }
// }
