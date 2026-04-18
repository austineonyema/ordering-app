import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { CreateUserRequest } from './dto/create-user-request';
import { User } from './schemas/user.schema';
import { PublicUser, RefreshUserRecord, toPublicUser } from './users.types';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(request: CreateUserRequest): Promise<PublicUser> {
    const normalizedEmail = this.normalizeEmail(request.email);
    await this.validateCreateUserRequest(normalizedEmail);
    const user = await this.usersRepository.create({
      ...request,
      email: normalizedEmail,
      password: request.password,
    });

    return toPublicUser(user);
  }

  private async validateCreateUserRequest(email: string) {
    const user = await this.usersRepository.findByEmail(email);

    if (user) {
      throw new UnprocessableEntityException('Email already exists.');
    }
  }

  async validateUser(email: string, password: string): Promise<PublicUser> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Credentials are not valid.');
    }

    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      throw new UnauthorizedException('Credentials are not valid.');
    }
    return toPublicUser(user);
  }

  async getUser(getUserArgs: Partial<User>): Promise<PublicUser> {
    return this.usersRepository.findOne(getUserArgs);
  }

  async findOneForAuth(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOneOptional<PublicUser>({
      _id: userId,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async findByIdForRefresh(userId: string): Promise<RefreshUserRecord> {
    const user = await this.usersRepository.findByIdForRefresh(userId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async updateRefreshToken(userId: string, refreshTokenHash: string) {
    await this.usersRepository.updateRefreshToken(userId, refreshTokenHash);
  }

  async clearRefreshSession(userId: string) {
    await this.usersRepository.clearRefreshSession(userId);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
