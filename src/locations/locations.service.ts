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

@Injectable()
export class LocationsService {
  constructor(
    private readonly locationsRepository: LocationsRepository,
    private readonly brandsService: BrandsService
  ) {}

  async findAll(
    limit?: number,
    cursor?: string,
    brandId?: string
  ): Promise<PaginatedResult<Location>> {
    return this.locationsRepository.findAll(
      limit || DEFAULT_PAGE_SIZE,
      cursor,
      brandId
    );
  }

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    // Verify brand exists
    await this.brandsService.findOne(createLocationDto.brandId);

    // Check uniqueness of brandId + name
    const existing = await this.locationsRepository.findByBrandIdAndName(
      createLocationDto.brandId,
      createLocationDto.name
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
      hasOffer: false,
      createdAt: now,
      updatedAt: now,
    };

    return this.locationsRepository.create(location);
  }

  async findOne(id: string): Promise<Location> {
    const location = await this.locationsRepository.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with id ${id} not found`);
    }
    return location;
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto
  ): Promise<Location> {
    const location = await this.findOne(id);

    // Check uniqueness if name is being updated
    if (updateLocationDto.name && updateLocationDto.name !== location.name) {
      const existing = await this.locationsRepository.findByBrandIdAndName(
        location.brandId,
        updateLocationDto.name
      );
      if (existing) {
        throw new ConflictException(
          `Location with name "${updateLocationDto.name}" already exists for this brand`
        );
      }
    }

    const updatedLocation: Location = {
      ...location,
      ...updateLocationDto,
      updatedAt: timestamp(),
    };

    return this.locationsRepository.update(updatedLocation);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.locationsRepository.delete(id);
  }
}
