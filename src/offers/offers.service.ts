import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Offer } from "../dynamodb/entities";
import { CreateOfferDto, UpdateOfferDto, FindAllOffersDto } from "./dto";
import { OffersRepository, PaginatedResult } from "./offers.repository";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { BrandsService } from "../brands/brands.service";
import { LocationsService } from "../locations/locations.service";
import { generateId, timestamp } from "../common/utils";

const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class OffersService {
  constructor(
    private readonly offersRepository: OffersRepository,
    private readonly dynamoDBService: DynamoDBService,
    private readonly brandsService: BrandsService,
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

    // Check if already linked
    if (location.offerIds?.has(offerId)) {
      throw new ConflictException(
        `Offer ${offerId} is already linked to this location`
      );
    }

    const now = new Date().toISOString();

    // Use transaction to update both tables atomically
    await this.dynamoDBService.transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: Tables.LOCATIONS,
            Key: { id: locationId },
            UpdateExpression:
              "ADD offerIds :offerId SET hasOffer = :hasOffer, updatedAt = :now",
            ExpressionAttributeValues: {
              ":offerId": new Set([offerId]),
              ":hasOffer": true,
              ":now": now,
            },
          },
        },
        {
          Update: {
            TableName: Tables.OFFERS,
            Key: { id: offerId },
            UpdateExpression:
              "ADD locationIds :locationId SET locationsTotal = locationsTotal + :inc, updatedAt = :now",
            ExpressionAttributeValues: {
              ":locationId": new Set([locationId]),
              ":inc": 1,
              ":now": now,
            },
          },
        },
      ],
    });

    return {
      ...offer,
      locationIds: new Set([...(offer.locationIds || []), locationId]),
      locationsTotal: offer.locationsTotal + 1,
      updatedAt: now,
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

    // Check if link exists
    if (!location.offerIds?.has(offerId)) {
      throw new NotFoundException(
        `Offer ${offerId} is not linked to this location`
      );
    }

    const now = new Date().toISOString();
    const remainingOffers = new Set(location.offerIds);
    remainingOffers.delete(offerId);
    const hasOffer = remainingOffers.size > 0;

    // Use transaction to update both tables atomically
    await this.dynamoDBService.transactWrite({
      TransactItems: [
        {
          Update: {
            TableName: Tables.LOCATIONS,
            Key: { id: locationId },
            UpdateExpression:
              "DELETE offerIds :offerId SET hasOffer = :hasOffer, updatedAt = :now",
            ExpressionAttributeValues: {
              ":offerId": new Set([offerId]),
              ":hasOffer": hasOffer,
              ":now": now,
            },
          },
        },
        {
          Update: {
            TableName: Tables.OFFERS,
            Key: { id: offerId },
            UpdateExpression:
              "DELETE locationIds :locationId SET locationsTotal = locationsTotal - :dec, updatedAt = :now",
            ConditionExpression: "locationsTotal > :zero",
            ExpressionAttributeValues: {
              ":locationId": new Set([locationId]),
              ":dec": 1,
              ":zero": 0,
              ":now": now,
            },
          },
        },
      ],
    });

    const newLocationIds = new Set(offer.locationIds);
    newLocationIds.delete(locationId);

    return {
      ...offer,
      locationIds: newLocationIds.size > 0 ? newLocationIds : undefined,
      locationsTotal: Math.max(0, offer.locationsTotal - 1),
      updatedAt: now,
    };
  }
}
