import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Query } from 'mongoose';
import { AbstractDocument } from '@app/common';

@Schema({ versionKey: false })
export class User extends AbstractDocument {
  @Prop()
  email!: string;

  @Prop({ select: false })
  password!: string;

  @Prop({ select: false, required: false })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  if (this.isModified('refreshTokenHash') && this.refreshTokenHash) {
    this.refreshTokenHash = await bcrypt.hash(this.refreshTokenHash, 10);
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function hashSensitiveFieldsOnUpdate(this: Query<unknown, User>) {
  const update = this.getUpdate() as unknown;

  if (Array.isArray(update) || !isRecord(update)) {
    return;
  }

  if (typeof update.password === 'string') {
    update.password = await bcrypt.hash(update.password, 10);
  }

  if (typeof update.refreshTokenHash === 'string') {
    update.refreshTokenHash = await bcrypt.hash(update.refreshTokenHash, 10);
  }

  const setObject = isRecord(update.$set) ? update.$set : undefined;
  if (!setObject) {
    this.setUpdate(update);
    return;
  }

  if (typeof setObject.password === 'string') {
    setObject.password = await bcrypt.hash(setObject.password, 10);
  }

  if (typeof setObject.refreshTokenHash === 'string') {
    setObject.refreshTokenHash = await bcrypt.hash(
      setObject.refreshTokenHash,
      10,
    );
  }

  this.setUpdate(update);
}

UserSchema.pre('findOneAndUpdate', hashSensitiveFieldsOnUpdate);
UserSchema.pre('updateOne', hashSensitiveFieldsOnUpdate);
