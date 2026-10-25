import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /**
   * Passed through to Resend's own Idempotency-Key support. Even if a job
   * runs twice (e.g. it dies after sending but before we record that it
   * sent), Resend itself will refuse to send the same email twice for the
   * same key.
   */
  idempotencyKey: string;
}

@Injectable()
export class ResendService {
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.fromAddress =
      this.configService.getOrThrow<string>('MAIL_FROM_ADDRESS');
  }

  async sendEmail(params: SendEmailParams): Promise<{ id: string }> {
    const { data, error } = await this.resend.emails.send(
      {
        from: this.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      },
      { idempotencyKey: params.idempotencyKey },
    );

    if (error || !data) {
      throw new Error(
        `Resend send failed: ${error?.message ?? 'unknown error'}`,
      );
    }

    return { id: data.id };
  }
}
