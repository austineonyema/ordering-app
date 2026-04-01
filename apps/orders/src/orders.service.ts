import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderRequest } from './dto/create-order.dto';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(@Inject() private readonly ordersRepository: OrdersRepository) {}
  getHello(): string {
    return 'Hello World!';
  }

  async createOrder(createOrderRequest: CreateOrderRequest) {
    return await this.ordersRepository.create(createOrderRequest);
  }
}
