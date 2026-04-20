import {
  // IsMongoId,
  IsPhoneNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class OrderRequestDto {
  @IsString()
  name!: string;

  @IsPositive()
  price!: number;

  @IsPhoneNumber()
  phoneNumber!: string;

  // @IsMongoId()
  // userId!: string;
}
