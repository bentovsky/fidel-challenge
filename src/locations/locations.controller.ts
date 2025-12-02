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
      query.brandId,
      query.limit,
      query.cursor
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
}
