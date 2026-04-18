import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { AbstractRepository } from '@app/common';
import { User } from './schemas/user.schema';
import { RefreshUserRecord, UserWithPassword } from './users.types';

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
    return this.findOneOptional<UserWithPassword>(
      { email },
      { select: '+password' },
    );
  }

  async findByIdForRefresh(userId: string): Promise<RefreshUserRecord | null> {
    return this.findOneOptional<RefreshUserRecord>(
      { _id: userId },
      { select: '+refreshTokenHash' },
    );
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string) {
    return this.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          refreshTokenHash,
        },
      },
    );
  }

  async clearRefreshSession(userId: string) {
    return this.findOneAndUpdate(
      { _id: userId },
      {
        $unset: {
          refreshTokenHash: '',
        },
      },
    );
  }
}
