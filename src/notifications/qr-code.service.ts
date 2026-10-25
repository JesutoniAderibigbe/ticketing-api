import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  /**
   * Encodes just the ticket code — not a URL, not JSON. The gate endpoint
   * takes the code and looks it up.
   */
  toDataUrl(ticketCode: string): Promise<string> {
    return QRCode.toDataURL(ticketCode);
  }
}
