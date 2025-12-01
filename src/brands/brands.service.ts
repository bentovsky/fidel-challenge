import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { Brand } from "../dynamodb/entities";
import { CreateBrandDto, UpdateBrandDto } from "./dto";
import { BrandsRepository, PaginatedResult } from "./brands.repository";
import { generateId, timestamp } from "../common/utils";

const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class BrandsService {
  constructor(private readonly brandsRepository: BrandsRepository) {}

  async findAll(limit?: number, cursor?: string): Promise<PaginatedResult<Brand>> {
    return this.brandsRepository.findAll(limit || DEFAULT_PAGE_SIZE, cursor);
  }

  async create(createBrandDto: CreateBrandDto): Promise<Brand> {
    const existing = await this.brandsRepository.findByName(createBrandDto.name);
    if (existing) {
      throw new ConflictException(`Brand with name "${createBrandDto.name}" already exists`);
    }

    const now = timestamp();
    const brand: Brand = {
      id: generateId(),
      ...createBrandDto,
      createdAt: now,
      updatedAt: now,
    };

    return this.brandsRepository.create(brand);
  }

  async findOne(id: string): Promise<Brand> {
    const brand = await this.brandsRepository.findById(id);
    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }
    return brand;
  }

  async update(id: string, updateBrandDto: UpdateBrandDto): Promise<Brand> {
    const brand = await this.findOne(id);

    if (updateBrandDto.name && updateBrandDto.name !== brand.name) {
      const existing = await this.brandsRepository.findByName(updateBrandDto.name);
      if (existing) {
        throw new ConflictException(`Brand with name "${updateBrandDto.name}" already exists`);
      }
    }

    const updatedBrand: Brand = {
      ...brand,
      ...updateBrandDto,
      updatedAt: timestamp(),
    };

    return this.brandsRepository.update(updatedBrand);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.brandsRepository.delete(id);
  }
}
