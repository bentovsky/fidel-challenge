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
} from "@nestjs/common";
import { BrandsService } from "./brands.service";
import { CreateBrandDto, UpdateBrandDto, FindAllBrandsDto } from "./dto";

@Controller("brands")
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll(@Query() query: FindAllBrandsDto) {
    return this.brandsService.findAll(query.limit, query.cursor);
  }

  @Post()
  create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(createBrandDto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.brandsService.findOne(id);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.brandsService.remove(id);
  }
}
