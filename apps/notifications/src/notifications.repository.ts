export interface NotificationsRepository {
  create(record: {
    userId?: string;
    recipient: string;
    channel: 'email' | 'sms' | 'push';
    type: string;
    idempotencyKey: string;
    status: 'pending' | 'sent' | 'failed';
    provider?: string;
    providerMessageId?: string;
    payload: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void>;

  markSent(idempotencyKey: string, providerMessageId?: string): Promise<void>;

  markFailed(idempotencyKey: string, errorMessage: string): Promise<void>;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<Record<string, unknown> | null>;
}
