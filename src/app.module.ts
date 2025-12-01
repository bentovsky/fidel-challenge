import { Module } from '@nestjs/common';
import { DynamoDBModule } from './dynamodb/dynamodb.module';

@Module({
  imports: [DynamoDBModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
