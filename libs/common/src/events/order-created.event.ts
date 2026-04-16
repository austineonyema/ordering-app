import { OrderRequestDto } from '../dto/order-request.dto';

export interface OrderCreatedEvent {
  request: OrderRequestDto;
  Authentication: string;
}
