import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { WebhookEvent } from './entities/webhook-event.entity';

@Injectable()
export class WebhookEventRepository extends Repository<WebhookEvent> {
  constructor(dataSource: DataSource) {
    super(WebhookEvent, dataSource.createEntityManager());
  }

  /**
   * Records a provider event id as seen. Returns false if it was already
   * recorded (duplicate delivery) so the caller can short-circuit without
   * reprocessing. Relies on the unique constraint on providerEventId, not a
   * prior SELECT, because two concurrent retries could both pass a
   * SELECT-then-INSERT check — the unique index cannot be raced.
   */
  async recordEvent(
    providerEventId: string,
    eventType: string,
  ): Promise<boolean> {
    const event = this.create({ providerEventId, eventType });

    try {
      await this.insert(event);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return false;
      }
      throw new InternalServerErrorException();
    }
  }
}
