import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamoDBModule } from './dynamodb/dynamodb.module';
import { BrandsModule } from './brands/brands.module';
import { LocationsModule } from './locations/locations.module';
import { OffersModule } from './offers/offers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DynamoDBModule,
    BrandsModule,
    LocationsModule,
    OffersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
