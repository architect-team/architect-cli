import { Controller, Get, Param } from '@nestjs/common';
import { User } from './user.entity';
import { UserService } from './user.service';

@Controller('user')
export class UserController {

  constructor(
    private readonly userService: UserService
  ) { }

  @Get()
  getAllUsers(): Promise<User[]> {
    return this.userService.findAllUsers();
  }

  @Get(':id')
  getUserById(@Param('id') userId: string): Promise<User> {
    return this.userService.findOneUser(userId);
  }

}
