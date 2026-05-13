export interface MailMessage {
  to: string;
  subject: string;
  templateKey: string;
  variables: Record<string, unknown>;
}
