import { Module, forwardRef } from "@nestjs/common";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { OffersRepository } from "./offers.repository";
import { BrandsModule } from "../brands/brands.module";
import { LocationsModule } from "../locations/locations.module";

@Module({
  imports: [BrandsModule, forwardRef(() => LocationsModule)],
  controllers: [OffersController],
  providers: [OffersRepository, OffersService],
  exports: [OffersService],
})
export class OffersModule {}
