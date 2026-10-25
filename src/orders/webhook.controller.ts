import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { PaystackSignatureGuard } from './paystack-signature.guard';
import type { PaystackWebhookPayload } from './paystack-webhook-payload.interface';

@Controller('webhooks')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Post('paystack')
  @UseGuards(PaystackSignatureGuard)
  @HttpCode(200)
  async handlePaystackWebhook(
    @Body() payload: PaystackWebhookPayload,
  ): Promise<{ received: boolean }> {
    await this.webhookService.handlePaystackEvent(payload);
    return { received: true };
  }
}
