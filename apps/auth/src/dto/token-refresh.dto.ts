import { IsNotEmpty, IsString } from 'class-validator';

export class TokenRefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
