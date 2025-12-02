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
import { OffersService } from "./offers.service";
import { CreateOfferDto, UpdateOfferDto, FindAllOffersDto } from "./dto";

@Controller("offers")
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  findAll(@Query() query: FindAllOffersDto) {
    return this.offersService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.offersService.findOne(id);
  }

  @Post()
  create(@Body() createOfferDto: CreateOfferDto) {
    return this.offersService.create(createOfferDto);
  }

  @Put(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateOfferDto: UpdateOfferDto
  ) {
    return this.offersService.update(id, updateOfferDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.offersService.remove(id);
  }

  @Post(":id/locations/:locationId")
  @HttpCode(HttpStatus.CREATED)
  linkToLocation(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("locationId", ParseUUIDPipe) locationId: string
  ) {
    return this.offersService.linkToLocation(id, locationId);
  }

  @Delete(":id/locations/:locationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkFromLocation(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("locationId", ParseUUIDPipe) locationId: string
  ) {
    return this.offersService.unlinkFromLocation(id, locationId);
  }
}
