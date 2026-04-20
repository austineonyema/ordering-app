import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractDocument } from '@app/common';
import { Types } from 'mongoose';

@Schema({
  versionKey: false,
})
export class Order extends AbstractDocument {
  @Prop()
  name!: string;

  @Prop()
  price!: number;

  @Prop()
  phoneNumber!: string;

  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;
}
export const OrdersSchema = SchemaFactory.createForClass(Order);
