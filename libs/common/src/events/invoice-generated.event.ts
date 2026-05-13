export interface InvoiceGeneratedEvent {
  userId: string;
  email: string;
  invoiceId: string;
  amount: number;
}
