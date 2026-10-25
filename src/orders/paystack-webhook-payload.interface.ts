export interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number | string;
    reference: string;
    amount: number;
    [key: string]: unknown;
  };
}
