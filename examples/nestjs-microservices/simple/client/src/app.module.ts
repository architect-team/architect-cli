import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { RootController } from 'src/root.controller';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [RootController, AppController],
  providers: [
    {
      provide: 'HELLO_SERVICE',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ClientProxyFactory.create({
        transport: Transport.TCP,
        options: {
          host: configService.get('HELLO_SERVICE_HOST'),
          port: configService.get('HELLO_SERVICE_PORT'),
        },
      }),
    }
  ],
})
export class AppModule {}
