import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Location } from "../dynamodb/entities";
import { CreateLocationDto, UpdateLocationDto } from "./dto";
import { LocationsRepository, PaginatedResult } from "./locations.repository";
import { BrandsService } from "../brands/brands.service";
import { generateId, timestamp } from "../common/utils";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Service for managing location entities.
 * Handles CRUD operations with brand validation and uniqueness checks.
 */
@Injectable()
export class LocationsService {
  constructor(
    private readonly locationsRepository: LocationsRepository,
    private readonly brandsService: BrandsService
  ) {}

  /**
   * Retrieves a paginated list of locations for a specific brand.
   * @param brandId - The brand ID to filter locations by (required)
   * @param limit - Maximum number of locations to return (default: 10)
   * @param cursor - Pagination cursor for fetching next page
   * @returns Paginated result containing locations and optional next cursor
   */
  async findAll(
    brandId: string,
    limit?: number,
    cursor?: string
  ): Promise<PaginatedResult<Location>> {
    return this.locationsRepository.findAll(
      limit || DEFAULT_PAGE_SIZE,
      cursor,
      brandId
    );
  }

  /**
   * Creates a new location for a brand.
   * @param createLocationDto - Location creation data including brandId
   * @returns The newly created location with hasOffer set to false
   * @throws NotFoundException if the brand doesn't exist
   * @throws ConflictException if a location with the same name exists for the brand (case-insensitive)
   */
  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    await this.brandsService.findOne(createLocationDto.brandId);

    const nameLower = createLocationDto.name.toLowerCase();
    const existing = await this.locationsRepository.findByBrandIdAndNameLower(
      createLocationDto.brandId,
      nameLower
    );
    if (existing) {
      throw new ConflictException(
        `Location with name "${createLocationDto.name}" already exists for this brand`
      );
    }

    const now = timestamp();
    const location: Location = {
      id: generateId(),
      ...createLocationDto,
      nameLower,
      hasOffer: false,
      createdAt: now,
      updatedAt: now,
    };

    return this.locationsRepository.create(location);
  }

  /**
   * Retrieves a location by ID.
   * @param id - The location ID
   * @returns The location entity
   * @throws NotFoundException if location doesn't exist
   */
  async findOne(id: string): Promise<Location> {
    const location = await this.locationsRepository.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with id ${id} not found`);
    }
    return location;
  }

  /**
   * Updates an existing location.
   * @param id - The location ID to update
   * @param updateLocationDto - Partial location data to update
   * @returns The updated location
   * @throws NotFoundException if location doesn't exist
   * @throws ConflictException if new name conflicts with existing location for the brand (case-insensitive)
   */
  async update(
    id: string,
    updateLocationDto: UpdateLocationDto
  ): Promise<Location> {
    const location = await this.findOne(id);

    let nameLower: string | undefined;
    if (updateLocationDto.name) {
      nameLower = updateLocationDto.name.toLowerCase();
      if (nameLower !== location.nameLower) {
        const existing = await this.locationsRepository.findByBrandIdAndNameLower(
          location.brandId,
          nameLower
        );
        if (existing) {
          throw new ConflictException(
            `Location with name "${updateLocationDto.name}" already exists for this brand`
          );
        }
      }
    }

    const updatedLocation: Location = {
      ...location,
      ...updateLocationDto,
      ...(nameLower && { nameLower }),
      updatedAt: timestamp(),
    };

    return this.locationsRepository.update(updatedLocation);
  }

  /**
   * Deletes a location by ID.
   * @param id - The location ID to delete
   * @throws NotFoundException if location doesn't exist
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.locationsRepository.delete(id);
  }
}
