import { Inject, Injectable } from '@nestjs/common';
import { OrderCreatedEvent } from '@app/common';
import { CreateOrderRequest } from './dto/create-order.dto';
import { OrdersRepository } from './orders.repository';
import { BILLING_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Types } from 'mongoose';
@Injectable()
export class OrdersService {
  constructor(
    @Inject() private readonly ordersRepository: OrdersRepository,
    @Inject(BILLING_SERVICE) private billingClient: ClientProxy,
  ) {}

  async getOrders() {
    return await this.ordersRepository.find({});
  }

  async createOrder(request: CreateOrderRequest, authorization?: string) {
    const session = await this.ordersRepository.startTransaction();
    try {
      const order = await this.ordersRepository.create(
        { ...request, userId: new Types.ObjectId(request.userId) },
        { session },
      );
      const eventPayload: OrderCreatedEvent = {
        request,
        Authorization: authorization ?? '',
      };
      await lastValueFrom(
        this.billingClient.emit('order_created', eventPayload),
      );
      await session.commitTransaction();
      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  async getUserOrders(userId: string) {
    // async getUserOrders(userId: string, user: PlainAuth) {
    return await this.ordersRepository.find({
      userId: new Types.ObjectId(userId),
    });
  }
}
