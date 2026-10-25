import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@Injectable()
export class PaystackSignatureGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithRawBody>();

    const signature = request.headers['x-paystack-signature'];

    if (typeof signature !== 'string' || !request.rawBody) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const secretKey = this.configService.getOrThrow<string>(
      'PAYSTACK_SECRET_KEY',
    );

    const expectedHash = createHmac('sha512', secretKey)
      .update(request.rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHash, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
