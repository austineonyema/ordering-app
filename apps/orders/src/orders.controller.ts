import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderRequest } from './dto/create-order.dto';
import { CurrentUser, JwtAuthGuard, type PlainAuth } from '@app/common';
import { UserOrdersDto } from './dto/user-order.dto';

interface OrdersRequest {
  headers?: {
    authorization?: string;
  };
}

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getOrders() {
    return await this.ordersService.getOrders();
  }

  @Get('self')
  @UseGuards(JwtAuthGuard)
  async getUserOrders(@CurrentUser() user: PlainAuth) {
    // return await this.ordersService.getUserOrders(user._id, user);
    return await this.ordersService.getUserOrders(user._id);
  }
  //Todo will implememnt RBAC to enable admin only
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserOrdersByid(@Param() userId: UserOrdersDto) {
    return await this.ordersService.getUserOrders(userId.id);
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
