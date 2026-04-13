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

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(request: CreateUserRequest) {
    await this.validateCreateUserRequest(request);
    const hashedPassword = await bcrypt.hash(request.password, 10);
    const user = await this.usersRepository.create({
      ...request,
      password: hashedPassword,
    });
    return user;
  }

  private async validateCreateUserRequest(request: CreateUserRequest) {
    let user: User | null = null;
    try {
      user = await this.usersRepository.findOne({
        email: request.email,
      });
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }

    if (user) {
      throw new UnprocessableEntityException('Email already exists.');
    }
  }

  async validateUser(email: string, password: string) {
    let user: User;
    try {
      user = await this.usersRepository.findOne({ email });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Credentials are not valid.');
      }

      throw error;
    }

    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      throw new UnauthorizedException('Credentials are not valid.');
    }
    return user;
  }

  async getUser(getUserArgs: Partial<User>) {
    return this.usersRepository.findOne(getUserArgs);
  }
}
