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
import { generateId, timestamp, hasItem } from "../common/utils";

const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class OffersService {
  constructor(
    private readonly offersRepository: OffersRepository,
    private readonly dynamoDBService: DynamoDBService,
    private readonly brandsService: BrandsService,
    private readonly locationsService: LocationsService
  ) {}

  /**
   * Retrieves a paginated list of offers for a specific brand.
   * @param query - Query parameters including required brandId
   * @returns Paginated result containing offers and optional next cursor
   */
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

  /**
   * Links a location to an offer using a DynamoDB transaction.
   * Atomically updates both the offer and location records.
   *
   * @param offerId - The ID of the offer to link
   * @param locationId - The ID of the location to link to the offer
   * @returns The updated offer with incremented locationsTotal
   * @throws NotFoundException if offer or location doesn't exist
   * @throws ConflictException if location belongs to a different brand or is already linked
   */
  async linkToLocation(offerId: string, locationId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    const location = await this.locationsService.findOne(locationId);
    if (location.brandId !== offer.brandId) {
      throw new ConflictException(
        "Cannot link offer to a location from a different brand"
      );
    }

    if (hasItem(location.offerIds, offerId)) {
      throw new ConflictException(
        `Offer ${offerId} is already linked to this location`
      );
    }

    const now = new Date().toISOString();

    // Use transaction to update both tables atomically
    // ConditionExpressions prevent race conditions by checking at write time
    try {
      await this.dynamoDBService.transactWrite({
        TransactItems: [
          {
            Update: {
              TableName: Tables.LOCATIONS,
              Key: { id: locationId },
              UpdateExpression:
                "ADD offerIds :offerId SET hasOffer = :hasOffer, updatedAt = :now",
              ConditionExpression:
                "attribute_not_exists(offerIds) OR NOT contains(offerIds, :offerIdValue)",
              ExpressionAttributeValues: {
                ":offerId": new Set([offerId]),
                ":offerIdValue": offerId,
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
              ConditionExpression:
                "attribute_not_exists(locationIds) OR NOT contains(locationIds, :locationIdValue)",
              ExpressionAttributeValues: {
                ":locationId": new Set([locationId]),
                ":locationIdValue": locationId,
                ":inc": 1,
                ":now": now,
              },
            },
          },
        ],
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException"
      ) {
        throw new ConflictException(
          `Offer ${offerId} is already linked to location ${locationId}`
        );
      }
      throw error;
    }

    return {
      ...offer,
      locationIds: new Set([...(offer.locationIds || []), locationId]),
      locationsTotal: offer.locationsTotal + 1,
      updatedAt: now,
    };
  }

  /**
   * Unlinks a location from an offer using a DynamoDB transaction.
   * Atomically updates both the offer and location records.
   * Sets hasOffer to false if no other offers are linked to the location.
   *
   * @param offerId - The ID of the offer to unlink
   * @param locationId - The ID of the location to unlink from the offer
   * @returns The updated offer with decremented locationsTotal
   * @throws NotFoundException if offer, location, or link doesn't exist
   * @throws ConflictException if location belongs to a different brand
   */
  async unlinkFromLocation(offerId: string, locationId: string): Promise<Offer> {
    const offer = await this.findOne(offerId);

    const location = await this.locationsService.findOne(locationId);
    if (location.brandId !== offer.brandId) {
      throw new ConflictException(
        "Cannot unlink offer from a location from a different brand"
      );
    }

    if (!hasItem(location.offerIds, offerId)) {
      throw new NotFoundException(
        `Offer ${offerId} is not linked to this location`
      );
    }

    const now = new Date().toISOString();
    const offerIdsArray = location.offerIds instanceof Set
      ? Array.from(location.offerIds)
      : (location.offerIds || []);
    const hasOffer = offerIdsArray.filter(id => id !== offerId).length > 0;

    // Use transaction to update both tables atomically
    // ConditionExpressions prevent race conditions by checking at write time
    try {
      await this.dynamoDBService.transactWrite({
        TransactItems: [
          {
            Update: {
              TableName: Tables.LOCATIONS,
              Key: { id: locationId },
              UpdateExpression:
                "DELETE offerIds :offerId SET hasOffer = :hasOffer, updatedAt = :now",
              ConditionExpression: "contains(offerIds, :offerIdValue)",
              ExpressionAttributeValues: {
                ":offerId": new Set([offerId]),
                ":offerIdValue": offerId,
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
              ConditionExpression:
                "locationsTotal > :zero AND contains(locationIds, :locationIdValue)",
              ExpressionAttributeValues: {
                ":locationId": new Set([locationId]),
                ":locationIdValue": locationId,
                ":dec": 1,
                ":zero": 0,
                ":now": now,
              },
            },
          },
        ],
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "TransactionCanceledException"
      ) {
        throw new NotFoundException(
          `Offer ${offerId} is not linked to location ${locationId}`
        );
      }
      throw error;
    }

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
