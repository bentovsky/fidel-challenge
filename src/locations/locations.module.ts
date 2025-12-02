import { Module } from "@nestjs/common";
import { LocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";
import { LocationsRepository } from "./locations.repository";
import { BrandsModule } from "../brands/brands.module";

@Module({
  imports: [BrandsModule],
  controllers: [LocationsController],
  providers: [LocationsRepository, LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
