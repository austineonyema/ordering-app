import { Controller } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { type InvoiceGeneratedEvent } from '@app/common/events/invoice-generated.event';
import { type UserRegisteredEvent } from '@app/common/events/user-registered.event';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @EventPattern('user_registered')
  handleUserRegistered(@Payload() event: UserRegisteredEvent) {}

  @EventPattern('invoice_generated')
  handleInvoiceGenerated(@Payload() event: InvoiceGeneratedEvent) {}
}
