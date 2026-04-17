import { IsNotEmpty, IsString } from 'class-validator';

export class TokenLogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
