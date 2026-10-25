import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column({ unique: true })
  providerEventId?: string;

  @Column()
  eventType?: string;

  @CreateDateColumn()
  createdAt?: Date;
}
