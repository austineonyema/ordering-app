import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users/users.service';
import { PublicUser, toPublicUser } from './users/users.types';

type TokenPurpose = 'access' | 'refresh';

export interface TokenPayload {
  userId: string;
  email: string;
  type: TokenPurpose;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(user: PublicUser) {
    const accessTokenPayload = this.createTokenPayload(user, 'access');
    const refreshTokenPayload = this.createTokenPayload(user, 'refresh');

    const accessToken = this.jwtService.sign(accessTokenPayload);
    const refreshToken = this.generateRefreshToken(refreshTokenPayload);

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

    if (payload.type !== 'refresh') {
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

    const publicUser = toPublicUser(user);
    const nextAccessTokenPayload = this.createTokenPayload(
      publicUser,
      'access',
    );
    const nextRefreshTokenPayload = this.createTokenPayload(
      publicUser,
      'refresh',
    );

    const accessToken = this.jwtService.sign(nextAccessTokenPayload);
    const nextRefreshToken = this.generateRefreshToken(nextRefreshTokenPayload);

    await this.usersService.updateRefreshToken(
      user._id.toHexString(),
      nextRefreshToken,
    );

    return {
      user: publicUser,
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

    if (payload.type !== 'refresh') {
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

  private createTokenPayload(
    user: PublicUser,
    type: TokenPurpose,
  ): TokenPayload {
    return {
      userId: user._id.toHexString(),
      email: user.email,
      type,
    };
  }

  private generateRefreshToken(payload: TokenPayload) {
    return this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshExpirationInSeconds(),
    });
  }

  private getRefreshSecret() {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  private getRefreshExpirationInSeconds() {
    const configuredExpiration = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRATION',
    );

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
