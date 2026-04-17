import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import JwtAuthGuard from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from './users/schemas/user.schema';
import { TokenRefreshDto } from './dto/token-refresh.dto';
import { TokenLogoutDto } from './dto/token-logout.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@CurrentUser() user: User) {
    return this.authService.login(user);
  }

  @Post('refresh')
  refresh(@Body() dto: TokenRefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: TokenLogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @MessagePattern('validate_user')
  validateUser(@CurrentUser() user: User) {
    return user;
  }
}
