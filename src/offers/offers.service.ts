import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { Offer } from "../dynamodb/entities";
import { CreateOfferDto, UpdateOfferDto, FindAllOffersDto } from "./dto";
import { OffersRepository, PaginatedResult } from "./offers.repository";
import { BrandsService } from "../brands/brands.service";
import { LocationsService } from "../locations/locations.service";
import { generateId, timestamp } from "../common/utils";

const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class OffersService {
  constructor(
    private readonly offersRepository: OffersRepository,
    private readonly brandsService: BrandsService,
    @Inject(forwardRef(() => LocationsService))
    private readonly locationsService: LocationsService
  ) {}

  async findAll(query: FindAllOffersDto): Promise<PaginatedResult<Offer>> {
    return this.offersRepository.findAll(
      query.limit || DEFAULT_PAGE_SIZE,
      query.cursor,
      query.brandId
    );
  }

  async create(createOfferDto: CreateOfferDto): Promise<Offer> {
    // Verify brand exists
    await this.brandsService.findOne(createOfferDto.brandId);

    // Check uniqueness of brandId + name
    const existing = await this.offersRepository.findByBrandIdAndName(
      createOfferDto.brandId,
      createOfferDto.name
    );
    if (existing) {
      throw new ConflictException(
        `Offer with name "${createOfferDto.name}" already exists for this brand`
      );
    }

    const now = timestamp();
    const offer: Offer = {
      id: generateId(),
      ...createOfferDto,
      locationsTotal: 0,
      createdAt: now,
      updatedAt: now,
    };

    return this.offersRepository.create(offer);
  }

  async findOne(id: string): Promise<Offer> {
    const offer = await this.offersRepository.findById(id);
    if (!offer) {
      throw new NotFoundException(`Offer with id ${id} not found`);
    }
    return offer;
  }

  async update(id: string, updateOfferDto: UpdateOfferDto): Promise<Offer> {
    const offer = await this.findOne(id);

    // Check uniqueness if name is being updated
    if (updateOfferDto.name && updateOfferDto.name !== offer.name) {
      const existing = await this.offersRepository.findByBrandIdAndName(
        offer.brandId,
        updateOfferDto.name
      );
      if (existing) {
        throw new ConflictException(
          `Offer with name "${updateOfferDto.name}" already exists for this brand`
        );
      }
    }

    const updatedOffer: Offer = {
      ...offer,
      ...updateOfferDto,
      updatedAt: timestamp(),
    };

    return this.offersRepository.update(updatedOffer);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.offersRepository.delete(id);
  }

  async linkToLocation(offerId: string, locationId: string): Promise<Offer> {
    // Validate offer exists
    const offer = await this.findOne(offerId);

    // Validate location exists and belongs to the same brand
    const location = await this.locationsService.findOne(locationId);
    if (location.brandId !== offer.brandId) {
      throw new ConflictException(
        "Cannot link offer to a location from a different brand"
      );
    }

    // Link offer to location
    await this.locationsService.addOffer(locationId, offerId);

    // Increment locations counter
    await this.offersRepository.incrementLocationsTotal(offerId);

    return {
      ...offer,
      locationsTotal: offer.locationsTotal + 1,
      updatedAt: timestamp(),
    };
  }

  async unlinkFromLocation(offerId: string, locationId: string): Promise<Offer> {
    // Validate offer exists
    const offer = await this.findOne(offerId);

    // Validate location exists and belongs to the same brand
    const location = await this.locationsService.findOne(locationId);
    if (location.brandId !== offer.brandId) {
      throw new ConflictException(
        "Cannot unlink offer from a location from a different brand"
      );
    }

    // Unlink offer from location (LocationsService validates link exists)
    await this.locationsService.removeOffer(locationId, offerId);

    // Decrement locations counter
    await this.offersRepository.decrementLocationsTotal(offerId);

    return {
      ...offer,
      locationsTotal: Math.max(0, offer.locationsTotal - 1),
      updatedAt: timestamp(),
    };
  }
}
