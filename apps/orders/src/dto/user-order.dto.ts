import { IsMongoId } from 'class-validator';

export class UserOrdersDto {
  @IsMongoId()
  id!: string;
}
