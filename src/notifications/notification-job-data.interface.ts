export interface TicketDeliveryJobData {
  notificationId: string;
  orderId: string;
  ticketIds: string[];
}

export interface OrderConfirmationJobData {
  notificationId: string;
  orderId: string;
}
