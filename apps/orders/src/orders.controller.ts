import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderRequest } from './dto/create-order.dto';
import { JwtAuthGuard } from '@app/common';

interface OrdersRequest {
  headers?: {
    authorization?: string;
  };
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getOrders() {
    return await this.ordersService.getOrders();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrder(
    @Body() request: CreateOrderRequest,
    @Req() req: OrdersRequest,
  ) {
    return await this.ordersService.createOrder(
      request,
      req.headers?.authorization,
    );
  }
}
