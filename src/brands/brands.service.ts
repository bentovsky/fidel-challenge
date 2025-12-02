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
    const nameLower = createBrandDto.name.toLowerCase();
    const existing = await this.brandsRepository.findByNameLower(nameLower);
    if (existing) {
      throw new ConflictException(`Brand with name "${createBrandDto.name}" already exists`);
    }

    const now = timestamp();
    const brand: Brand = {
      id: generateId(),
      ...createBrandDto,
      nameLower,
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

    let nameLower: string | undefined;
    if (updateBrandDto.name) {
      nameLower = updateBrandDto.name.toLowerCase();
      if (nameLower !== brand.nameLower) {
        const existing = await this.brandsRepository.findByNameLower(nameLower);
        if (existing) {
          throw new ConflictException(`Brand with name "${updateBrandDto.name}" already exists`);
        }
      }
    }

    const updatedBrand: Brand = {
      ...brand,
      ...updateBrandDto,
      ...(nameLower && { nameLower }),
      updatedAt: timestamp(),
    };

    return this.brandsRepository.update(updatedBrand);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.brandsRepository.delete(id);
  }
}
