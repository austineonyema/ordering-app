import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { AbstractRepository } from '@app/common';
import { User } from './schemas/user.schema';
import { PublicUser, RefreshUserRecord, UserWithPassword } from './users.types';

@Injectable()
export class UsersRepository extends AbstractRepository<User> {
  protected readonly logger = new Logger(UsersRepository.name);

  constructor(
    @InjectModel(User.name) userModel: Model<User>,
    @InjectConnection() connection: Connection,
  ) {
    super(userModel, connection);
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    return this.model
      .findOne({ email }, {}, { lean: true })
      .lean<UserWithPassword>()
      .select('+password')
      .exec();
  }

  async findOneForAuth(userId: string): Promise<PublicUser | null> {
    return this.model
      .findById(userId, {}, { lean: true })
      .lean<PublicUser>()
      .exec();
  }

  async findByIdForRefresh(userId: string): Promise<RefreshUserRecord | null> {
    return this.model
      .findById(userId, {}, { lean: true })
      .lean<RefreshUserRecord>()
      .select('+refreshTokenHash')
      .exec();
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string) {
    return this.model
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            refreshTokenHash,
          },
        },
        { new: true, lean: true },
      )
      .exec();
  }

  async clearRefreshSession(userId: string) {
    return this.model
      .findByIdAndUpdate(
        userId,
        {
          $unset: {
            refreshTokenHash: '',
          },
        },
        { lean: true },
      )
      .exec();
  }
}
