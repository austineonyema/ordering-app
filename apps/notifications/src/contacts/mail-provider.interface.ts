import { MailMessage } from './mail-message.interface';

export interface MailProvider {
  send(message: MailMessage): Promise<{
    providerMessageId?: string;
    accepted: boolean;
  }>;
}
