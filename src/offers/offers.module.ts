import { Module } from "@nestjs/common";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { OffersRepository } from "./offers.repository";
import { DynamoDBModule } from "../dynamodb/dynamodb.module";
import { BrandsModule } from "../brands/brands.module";
import { LocationsModule } from "../locations/locations.module";

@Module({
  imports: [DynamoDBModule, BrandsModule, LocationsModule],
  controllers: [OffersController],
  providers: [OffersRepository, OffersService],
  exports: [OffersService],
})
export class OffersModule {}
