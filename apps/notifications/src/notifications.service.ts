import { InvoiceGeneratedEvent } from '@app/common/events/invoice-generated.event';
import { UserRegisteredEvent } from '@app/common/events/user-registered.event';
import { Injectable } from '@nestjs/common';
import { SendNotificationCommand } from './contacts/send-notification.command';

@Injectable()
export class NotificationsService {
  handleUserRegistered(event: UserRegisteredEvent): Promise<void>;

  handleInvoiceGenerated(event: InvoiceGeneratedEvent): Promise<void>;
  send(command: SendNotificationCommand): Promise<void>;
}
