import { IsPhoneNumber, IsPositive, IsString } from 'class-validator';

export class CreateOrderRequest {
  @IsString()
  name: string;

  @IsPositive()
  price: number;

  @IsPhoneNumber()
  phoneNumber: string;
}
