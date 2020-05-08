import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() { }

  @Get()
  getHelloWorld(): string {
    return 'Hello World'; //TODO:66: make this ENV variable
  }

}
