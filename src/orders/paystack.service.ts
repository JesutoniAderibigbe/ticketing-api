import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface InitializeTransactionParams {
  email: string;
  amountKobo: number;
  reference: string;
}

interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

@Injectable()
export class PaystackService {
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.getOrThrow<string>(
      'PAYSTACK_SECRET_KEY',
    );
  }

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo,
        reference: params.reference,
      }),
    });

    const body = (await response.json()) as PaystackInitializeResponse;

    if (!response.ok || !body.status || !body.data) {
      throw new InternalServerErrorException(
        `Paystack initialize transaction failed: ${body.message}`,
      );
    }

    return {
      authorizationUrl: body.data.authorization_url,
      accessCode: body.data.access_code,
      reference: body.data.reference,
    };
  }
}
