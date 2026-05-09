import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@app/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { User } from './users/schemas/user.schema';
import { TokenRefreshDto } from './dto/token-refresh.dto';
import { TokenLogoutDto } from './dto/token-logout.dto';
// import { MessagePattern, Payload } from '@nestjs/microservices';

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

  // @MessagePattern('get_user')
  // getUser(@Payload() data: { userId: string }) {
  //   return this.authService.getUser(data.userId);
  // }
}
