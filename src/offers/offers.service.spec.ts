import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { OffersService } from "./offers.service";
import { OffersRepository } from "./offers.repository";
import { DynamoDBService } from "../dynamodb/dynamodb.service";
import { BrandsService } from "../brands/brands.service";
import { LocationsService } from "../locations/locations.service";
import { Offer } from "../dynamodb/entities";
import { Brand } from "../dynamodb/entities";
import { Location } from "../dynamodb/entities";

describe("OffersService", () => {
  let service: OffersService;
  let repository: jest.Mocked<OffersRepository>;
  let dynamoDBService: jest.Mocked<DynamoDBService>;
  let brandsService: jest.Mocked<BrandsService>;
  let locationsService: jest.Mocked<LocationsService>;

  const mockBrand: Brand = {
    id: "brand-123",
    name: "Starbucks",
    nameLower: "starbucks",
    description: "Coffee company",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockOffer: Offer = {
    id: "offer-123",
    brandId: "brand-123",
    name: "Summer Sale",
    description: "10% off",
    locationsTotal: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockLocation: Location = {
    id: "loc-123",
    brandId: "brand-123",
    name: "Oxford Street",
    nameLower: "oxford street",
    address: "123 Oxford Street, London",
    hasOffer: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByBrandIdAndName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockDynamoDBService = {
      transactWrite: jest.fn(),
    };

    const mockBrandsService = {
      findOne: jest.fn(),
    };

    const mockLocationsService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: OffersRepository, useValue: mockRepository },
        { provide: DynamoDBService, useValue: mockDynamoDBService },
        { provide: BrandsService, useValue: mockBrandsService },
        { provide: LocationsService, useValue: mockLocationsService },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
    repository = module.get(OffersRepository);
    dynamoDBService = module.get(DynamoDBService);
    brandsService = module.get(BrandsService);
    locationsService = module.get(LocationsService);
  });

  describe("findAll", () => {
    it("should return paginated offers for a brand", async () => {
      const paginatedResult = {
        items: [mockOffer],
        nextCursor: "abc123",
      };
      repository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll({ brandId: "brand-123", limit: 10 });

      expect(repository.findAll).toHaveBeenCalledWith(10, undefined, "brand-123");
      expect(result).toEqual(paginatedResult);
    });

    it("should use default page size when limit is not provided", async () => {
      const paginatedResult = { items: [], nextCursor: undefined };
      repository.findAll.mockResolvedValue(paginatedResult);

      await service.findAll({ brandId: "brand-123" });

      expect(repository.findAll).toHaveBeenCalledWith(10, undefined, "brand-123");
    });

    it("should pass cursor for pagination", async () => {
      const paginatedResult = { items: [mockOffer], nextCursor: undefined };
      repository.findAll.mockResolvedValue(paginatedResult);

      await service.findAll({ brandId: "brand-123", limit: 5, cursor: "cursor123" });

      expect(repository.findAll).toHaveBeenCalledWith(5, "cursor123", "brand-123");
    });
  });

  describe("create", () => {
    const createOfferDto = {
      brandId: "brand-123",
      name: "Summer Sale",
      description: "10% off",
    };

    it("should create a new offer", async () => {
      brandsService.findOne.mockResolvedValue(mockBrand);
      repository.findByBrandIdAndName.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockOffer);

      const result = await service.create(createOfferDto);

      expect(brandsService.findOne).toHaveBeenCalledWith("brand-123");
      expect(repository.findByBrandIdAndName).toHaveBeenCalledWith(
        "brand-123",
        "Summer Sale"
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          brandId: "brand-123",
          name: "Summer Sale",
          description: "10% off",
          locationsTotal: 0,
        })
      );
      expect(result).toEqual(mockOffer);
    });

    it("should throw NotFoundException if brand doesn't exist", async () => {
      brandsService.findOne.mockRejectedValue(
        new NotFoundException("Brand not found")
      );

      await expect(service.create(createOfferDto)).rejects.toThrow(
        NotFoundException
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException if offer name already exists for brand", async () => {
      brandsService.findOne.mockResolvedValue(mockBrand);
      repository.findByBrandIdAndName.mockResolvedValue(mockOffer);

      await expect(service.create(createOfferDto)).rejects.toThrow(
        ConflictException
      );
      await expect(service.create(createOfferDto)).rejects.toThrow(
        'Offer with name "Summer Sale" already exists for this brand'
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should generate id and timestamps for new offer", async () => {
      brandsService.findOne.mockResolvedValue(mockBrand);
      repository.findByBrandIdAndName.mockResolvedValue(null);
      repository.create.mockImplementation(async (offer) => offer);

      const result = await service.create(createOfferDto);

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.locationsTotal).toBe(0);
    });
  });

  describe("findOne", () => {
    it("should return an offer by id", async () => {
      repository.findById.mockResolvedValue(mockOffer);

      const result = await service.findOne(mockOffer.id);

      expect(repository.findById).toHaveBeenCalledWith(mockOffer.id);
      expect(result).toEqual(mockOffer);
    });

    it("should throw NotFoundException if offer not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        "Offer with id non-existent-id not found"
      );
    });
  });

  describe("update", () => {
    const updateOfferDto = {
      name: "Winter Sale",
      description: "20% off",
    };

    it("should update an offer", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      repository.findByBrandIdAndName.mockResolvedValue(null);
      repository.update.mockImplementation(async (offer) => offer);

      const result = await service.update(mockOffer.id, updateOfferDto);

      expect(result.name).toBe("Winter Sale");
      expect(result.description).toBe("20% off");
    });

    it("should throw NotFoundException if offer not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update("non-existent-id", updateOfferDto)
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if new name conflicts with existing offer", async () => {
      const anotherOffer = { ...mockOffer, id: "different-id" };
      repository.findById.mockResolvedValue(mockOffer);
      repository.findByBrandIdAndName.mockResolvedValue(anotherOffer);

      await expect(
        service.update(mockOffer.id, { name: "Existing Offer" })
      ).rejects.toThrow(ConflictException);
    });

    it("should allow updating to same name (no conflict check)", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      repository.update.mockImplementation(async (offer) => offer);

      const result = await service.update(mockOffer.id, { name: mockOffer.name });

      expect(repository.findByBrandIdAndName).not.toHaveBeenCalled();
      expect(result.name).toBe(mockOffer.name);
    });

    it("should update only provided fields", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      repository.update.mockImplementation(async (offer) => offer);

      const result = await service.update(mockOffer.id, {
        description: "New description",
      });

      expect(result.name).toBe(mockOffer.name);
      expect(result.description).toBe("New description");
    });

    it("should update the updatedAt timestamp", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      repository.update.mockImplementation(async (offer) => offer);

      const result = await service.update(mockOffer.id, {
        description: "New description",
      });

      expect(result.updatedAt).not.toBe(mockOffer.updatedAt);
    });
  });

  describe("remove", () => {
    it("should delete an offer", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      repository.delete.mockResolvedValue(undefined);

      await service.remove(mockOffer.id);

      expect(repository.findById).toHaveBeenCalledWith(mockOffer.id);
      expect(repository.delete).toHaveBeenCalledWith(mockOffer.id);
    });

    it("should throw NotFoundException if offer not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });

  describe("linkToLocation", () => {
    it("should link a location to an offer", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      locationsService.findOne.mockResolvedValue(mockLocation);
      dynamoDBService.transactWrite.mockResolvedValue({ $metadata: {} });

      const result = await service.linkToLocation("offer-123", "loc-123");

      expect(dynamoDBService.transactWrite).toHaveBeenCalledWith({
        TransactItems: expect.arrayContaining([
          expect.objectContaining({
            Update: expect.objectContaining({
              TableName: "locations",
              Key: { id: "loc-123" },
            }),
          }),
          expect.objectContaining({
            Update: expect.objectContaining({
              TableName: "offers",
              Key: { id: "offer-123" },
            }),
          }),
        ]),
      });
      expect(result.locationsTotal).toBe(1);
    });

    it("should throw NotFoundException if offer not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.linkToLocation("non-existent", "loc-123")
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if location not found", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      locationsService.findOne.mockRejectedValue(
        new NotFoundException("Location not found")
      );

      await expect(
        service.linkToLocation("offer-123", "non-existent")
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if location belongs to different brand", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      locationsService.findOne.mockResolvedValue({
        ...mockLocation,
        brandId: "different-brand",
      });

      await expect(
        service.linkToLocation("offer-123", "loc-123")
      ).rejects.toThrow(ConflictException);
      await expect(
        service.linkToLocation("offer-123", "loc-123")
      ).rejects.toThrow("Cannot link offer to a location from a different brand");
    });

    it("should throw ConflictException if already linked", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      locationsService.findOne.mockResolvedValue({
        ...mockLocation,
        offerIds: new Set(["offer-123"]),
      });

      await expect(
        service.linkToLocation("offer-123", "loc-123")
      ).rejects.toThrow(ConflictException);
      await expect(
        service.linkToLocation("offer-123", "loc-123")
      ).rejects.toThrow("Offer offer-123 is already linked to this location");
    });

    it("should handle offerIds as array", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      locationsService.findOne.mockResolvedValue({
        ...mockLocation,
        offerIds: ["other-offer"] as unknown as Set<string>,
      });
      dynamoDBService.transactWrite.mockResolvedValue({ $metadata: {} });

      const result = await service.linkToLocation("offer-123", "loc-123");

      expect(result.locationsTotal).toBe(1);
    });
  });

  describe("unlinkFromLocation", () => {
    const linkedOffer: Offer = {
      ...mockOffer,
      locationIds: new Set(["loc-123"]),
      locationsTotal: 1,
    };

    const linkedLocation: Location = {
      ...mockLocation,
      offerIds: new Set(["offer-123"]),
      hasOffer: true,
    };

    it("should unlink a location from an offer", async () => {
      repository.findById.mockResolvedValue(linkedOffer);
      locationsService.findOne.mockResolvedValue(linkedLocation);
      dynamoDBService.transactWrite.mockResolvedValue({ $metadata: {} });

      const result = await service.unlinkFromLocation("offer-123", "loc-123");

      expect(dynamoDBService.transactWrite).toHaveBeenCalledWith({
        TransactItems: expect.arrayContaining([
          expect.objectContaining({
            Update: expect.objectContaining({
              TableName: "locations",
              Key: { id: "loc-123" },
            }),
          }),
          expect.objectContaining({
            Update: expect.objectContaining({
              TableName: "offers",
              Key: { id: "offer-123" },
            }),
          }),
        ]),
      });
      expect(result.locationsTotal).toBe(0);
    });

    it("should throw NotFoundException if offer not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.unlinkFromLocation("non-existent", "loc-123")
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if location not found", async () => {
      repository.findById.mockResolvedValue(linkedOffer);
      locationsService.findOne.mockRejectedValue(
        new NotFoundException("Location not found")
      );

      await expect(
        service.unlinkFromLocation("offer-123", "non-existent")
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if location belongs to different brand", async () => {
      repository.findById.mockResolvedValue(linkedOffer);
      locationsService.findOne.mockResolvedValue({
        ...linkedLocation,
        brandId: "different-brand",
      });

      await expect(
        service.unlinkFromLocation("offer-123", "loc-123")
      ).rejects.toThrow(ConflictException);
      await expect(
        service.unlinkFromLocation("offer-123", "loc-123")
      ).rejects.toThrow("Cannot unlink offer from a location from a different brand");
    });

    it("should throw NotFoundException if not linked", async () => {
      repository.findById.mockResolvedValue(mockOffer);
      locationsService.findOne.mockResolvedValue(mockLocation);

      await expect(
        service.unlinkFromLocation("offer-123", "loc-123")
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.unlinkFromLocation("offer-123", "loc-123")
      ).rejects.toThrow("Offer offer-123 is not linked to this location");
    });

    it("should set hasOffer to false when last offer is unlinked", async () => {
      repository.findById.mockResolvedValue(linkedOffer);
      locationsService.findOne.mockResolvedValue(linkedLocation);
      dynamoDBService.transactWrite.mockResolvedValue({ $metadata: {} });

      await service.unlinkFromLocation("offer-123", "loc-123");

      expect(dynamoDBService.transactWrite).toHaveBeenCalledWith({
        TransactItems: expect.arrayContaining([
          expect.objectContaining({
            Update: expect.objectContaining({
              ExpressionAttributeValues: expect.objectContaining({
                ":hasOffer": false,
              }),
            }),
          }),
        ]),
      });
    });

    it("should keep hasOffer true when other offers remain", async () => {
      repository.findById.mockResolvedValue(linkedOffer);
      locationsService.findOne.mockResolvedValue({
        ...linkedLocation,
        offerIds: new Set(["offer-123", "other-offer"]),
      });
      dynamoDBService.transactWrite.mockResolvedValue({ $metadata: {} });

      await service.unlinkFromLocation("offer-123", "loc-123");

      expect(dynamoDBService.transactWrite).toHaveBeenCalledWith({
        TransactItems: expect.arrayContaining([
          expect.objectContaining({
            Update: expect.objectContaining({
              ExpressionAttributeValues: expect.objectContaining({
                ":hasOffer": true,
              }),
            }),
          }),
        ]),
      });
    });
  });
});
