import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@app/common';
import { SchemaTypes, Types } from 'mongoose';

@Schema({
  versionKey: false,
  timestamps: true,
})
export class Notification extends AbstractDocument {
  @Prop({ type: Types.ObjectId, required: false })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  recipient!: string;

  @Prop({
    required: true,
    enum: ['email', 'sms', 'push'],
  })
  channel!: 'email' | 'sms' | 'push';

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true, unique: true })
  idempotencyKey!: string;

  @Prop({
    required: true,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  })
  status!: 'pending' | 'sent' | 'failed';

  @Prop({ required: false })
  provider?: string;

  @Prop({ required: false })
  providerMessageId?: string;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: false })
  errorMessage?: string;
}

export const NotificationsSchema = SchemaFactory.createForClass(Notification);
