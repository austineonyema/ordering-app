import { type NotificationChannel } from './notification-channel.type';
import { type NotificationType } from './notification-type.type';

export interface SendNotificationCommand {
  recipient: string;
  channel: NotificationChannel;
  type: NotificationType;
  userId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}
