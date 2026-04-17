import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users/users.service';
import { PublicUser, toPublicUser } from './users/users.types';

export interface TokenPayload {
  userId: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(user: PublicUser) {
    const tokenPayload: TokenPayload = {
      userId: user._id.toHexString(),
      email: user.email,
    };

    const accessToken = this.jwtService.sign(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    await this.usersService.updateRefreshToken(
      user._id.toHexString(),
      refreshToken,
    );

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing.');
    }

    const refreshSecret = this.getRefreshSecret();

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.usersService.findByIdForRefresh(payload.userId);
    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Session expired.');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const nextPayload: TokenPayload = {
      userId: user._id.toHexString(),
      email: user.email,
    };

    const accessToken = this.jwtService.sign(nextPayload);
    const nextRefreshToken = this.generateRefreshToken(nextPayload);

    await this.usersService.updateRefreshToken(
      user._id.toHexString(),
      nextRefreshToken,
    );

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    const refreshSecret = this.getRefreshSecret();

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      return;
    }

    const user = await this.usersService.findByIdForRefresh(payload.userId);
    if (!user.refreshTokenHash) {
      return;
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!refreshTokenMatches) {
      return;
    }

    await this.usersService.clearRefreshSession(user._id.toHexString());
  }

  async validateUser(userId: string) {
    return this.usersService.findOneForAuth(userId);
  }

  private generateRefreshToken(payload: TokenPayload) {
    return this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshExpirationInSeconds(),
    });
  }

  private getRefreshSecret() {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET')
    );
  }

  private getRefreshExpirationInSeconds() {
    const configuredExpiration =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';

    const directSeconds = Number(configuredExpiration);
    if (!Number.isNaN(directSeconds)) {
      return directSeconds;
    }

    const durationMatch = configuredExpiration.match(/^(\d+)([smhd])$/);
    if (!durationMatch) {
      return 7 * 24 * 60 * 60;
    }

    const value = Number(durationMatch[1]);
    const unit = durationMatch[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
