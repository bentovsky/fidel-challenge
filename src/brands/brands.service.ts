import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { Brand } from "../dynamodb/entities";
import { CreateBrandDto, UpdateBrandDto } from "./dto";
import { BrandsRepository, PaginatedResult } from "./brands.repository";
import { generateId, timestamp } from "../common/utils";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Service for managing brand entities.
 * Handles CRUD operations with uniqueness validation on brand names.
 */
@Injectable()
export class BrandsService {
  constructor(private readonly brandsRepository: BrandsRepository) {}

  /**
   * Retrieves a paginated list of brands.
   * @param limit - Maximum number of brands to return (default: 10)
   * @param cursor - Pagination cursor for fetching next page
   * @returns Paginated result containing brands and optional next cursor
   */
  async findAll(limit?: number, cursor?: string): Promise<PaginatedResult<Brand>> {
    return this.brandsRepository.findAll(limit || DEFAULT_PAGE_SIZE, cursor);
  }

  /**
   * Creates a new brand.
   * @param createBrandDto - Brand creation data
   * @returns The newly created brand
   * @throws ConflictException if a brand with the same name already exists (case-insensitive)
   */
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

  /**
   * Retrieves a brand by ID.
   * @param id - The brand ID
   * @returns The brand entity
   * @throws NotFoundException if brand doesn't exist
   */
  async findOne(id: string): Promise<Brand> {
    const brand = await this.brandsRepository.findById(id);
    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found`);
    }
    return brand;
  }

  /**
   * Updates an existing brand.
   * @param id - The brand ID to update
   * @param updateBrandDto - Partial brand data to update
   * @returns The updated brand
   * @throws NotFoundException if brand doesn't exist
   * @throws ConflictException if new name conflicts with existing brand (case-insensitive)
   */
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

  /**
   * Deletes a brand by ID.
   * @param id - The brand ID to delete
   * @throws NotFoundException if brand doesn't exist
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.brandsRepository.delete(id);
  }
}
