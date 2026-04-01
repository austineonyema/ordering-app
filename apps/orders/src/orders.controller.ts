import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderRequest } from './dto/create-order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getHello(): string {
    return this.ordersService.getHello();
  }

  @Post()
  async createOrder(@Body() request: CreateOrderRequest) {
    return await this.ordersService.createOrder(request);
  }
}
