import { Inject, Injectable } from '@nestjs/common';
import { CreateOrderRequest } from './dto/create-order.dto';
import { OrdersRepository } from './orders.repository';
import { BILLING_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class OrdersService {
  constructor(
    @Inject() private readonly ordersRepository: OrdersRepository,
    @Inject(BILLING_SERVICE) private billingClient: ClientProxy,
  ) {}

  async getOrders() {
    return await this.ordersRepository.find({});
  }

  async createOrder(createOrderRequest: CreateOrderRequest) {
    return await this.ordersRepository.create(createOrderRequest);
  }
}
