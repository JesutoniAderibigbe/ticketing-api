import { EventStatus } from './entities/event-status.enum';

export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
  [EventStatus.PUBLISHED]: [EventStatus.CANCELLED],
  [EventStatus.CANCELLED]: [],
};
