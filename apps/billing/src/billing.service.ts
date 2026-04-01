import { Injectable, Logger } from '@nestjs/common';
import { OrderCreatedEvent } from '@app/common';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  getHello(): string {
    return 'Hello World!';
  }

  bill(data: OrderCreatedEvent) {
    this.logger.log('BIlling...', data);
  }
}
