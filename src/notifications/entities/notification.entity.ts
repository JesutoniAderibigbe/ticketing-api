import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { NotificationType } from './notification-type.enum';
import { NotificationStatus } from './notification-status.enum';

@Entity()
@Unique(['orderId', 'type'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  orderId?: string;

  @ManyToOne(() => Order, { eager: false })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ type: 'enum', enum: NotificationType })
  type?: NotificationType;

  @Column()
  recipientEmail?: string;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.QUEUED,
  })
  status?: NotificationStatus;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId?: string | null;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;
}
