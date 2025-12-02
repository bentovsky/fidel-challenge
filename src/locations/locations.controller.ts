import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { LocationsService } from "./locations.service";
import {
  CreateLocationDto,
  UpdateLocationDto,
  FindAllLocationsDto,
} from "./dto";

@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(@Query() query: FindAllLocationsDto) {
    return this.locationsService.findAll(
      query.limit,
      query.cursor,
      query.brandId
    );
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.locationsService.findOne(id);
  }

  @Post()
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Put(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateLocationDto: UpdateLocationDto
  ) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.locationsService.remove(id);
  }

  @Post(":id/offers/:offerId")
  @HttpCode(HttpStatus.CREATED)
  addOffer(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("offerId", ParseUUIDPipe) offerId: string
  ) {
    return this.locationsService.addOffer(id, offerId);
  }

  @Delete(":id/offers/:offerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOffer(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("offerId", ParseUUIDPipe) offerId: string
  ) {
    return this.locationsService.removeOffer(id, offerId);
  }
}
