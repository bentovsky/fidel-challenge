import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { OffersRepository } from "./offers.repository";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { Offer } from "../dynamodb/entities";

describe("OffersRepository", () => {
  let repository: OffersRepository;
  let dynamoDBService: jest.Mocked<DynamoDBService>;

  const mockMetadata = {
    httpStatusCode: 200,
    requestId: "test",
    attempts: 1,
    totalRetryDelay: 0,
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

  beforeEach(async () => {
    const mockDynamoDBService = {
      scan: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      query: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersRepository,
        {
          provide: DynamoDBService,
          useValue: mockDynamoDBService,
        },
      ],
    }).compile();

    repository = module.get<OffersRepository>(OffersRepository);
    dynamoDBService = module.get(DynamoDBService);
  });

  describe("findAll", () => {
    it("should return paginated offers using scan when no brandId", async () => {
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockOffer],
        LastEvaluatedKey: { id: "next-key" },
      });

      const result = await repository.findAll(10);

      expect(dynamoDBService.scan).toHaveBeenCalledWith(Tables.OFFERS, {
        Limit: 10,
        ExclusiveStartKey: undefined,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Offer);
      expect(result.nextCursor).toBeDefined();
    });

    it("should return paginated offers using query when brandId provided", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockOffer],
        LastEvaluatedKey: { id: "next-key", brandId: "brand-123" },
      });

      const result = await repository.findAll(10, undefined, "brand-123");

      expect(dynamoDBService.query).toHaveBeenCalledWith(Tables.OFFERS, {
        IndexName: "brandId-index",
        KeyConditionExpression: "brandId = :brandId",
        ExpressionAttributeValues: { ":brandId": "brand-123" },
        Limit: 10,
        ExclusiveStartKey: undefined,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Offer);
    });

    it("should return empty array when no items", async () => {
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: undefined,
      });

      const result = await repository.findAll(10);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should decode and pass cursor for pagination", async () => {
      const cursorData = { id: "last-key" };
      const encodedCursor = Buffer.from(JSON.stringify(cursorData)).toString(
        "base64"
      );
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [],
      });

      await repository.findAll(10, encodedCursor);

      expect(dynamoDBService.scan).toHaveBeenCalledWith(Tables.OFFERS, {
        Limit: 10,
        ExclusiveStartKey: cursorData,
      });
    });

    it("should throw BadRequestException for invalid cursor", async () => {
      const invalidCursor = "not-valid-base64!!!";

      await expect(repository.findAll(10, invalidCursor)).rejects.toThrow(
        BadRequestException
      );
      await expect(repository.findAll(10, invalidCursor)).rejects.toThrow(
        "Invalid cursor"
      );
    });

    it("should encode LastEvaluatedKey as nextCursor", async () => {
      const lastKey = { id: "last-id" };
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockOffer],
        LastEvaluatedKey: lastKey,
      });

      const result = await repository.findAll(10);

      const decodedCursor = JSON.parse(
        Buffer.from(result.nextCursor!, "base64").toString()
      );
      expect(decodedCursor).toEqual(lastKey);
    });
  });

  describe("create", () => {
    it("should create an offer and return it as instance", async () => {
      dynamoDBService.put.mockResolvedValue({ $metadata: mockMetadata });

      const result = await repository.create(mockOffer);

      expect(dynamoDBService.put).toHaveBeenCalledWith(Tables.OFFERS, {
        Item: mockOffer,
      });
      expect(result).toBeInstanceOf(Offer);
      expect(result.id).toBe(mockOffer.id);
    });
  });

  describe("findById", () => {
    it("should return offer when found", async () => {
      dynamoDBService.get.mockResolvedValue({
        $metadata: mockMetadata,
        Item: mockOffer,
      });

      const result = await repository.findById(mockOffer.id);

      expect(dynamoDBService.get).toHaveBeenCalledWith(Tables.OFFERS, {
        Key: { id: mockOffer.id },
      });
      expect(result).toBeInstanceOf(Offer);
      expect(result?.id).toBe(mockOffer.id);
    });

    it("should return null when offer not found", async () => {
      dynamoDBService.get.mockResolvedValue({
        $metadata: mockMetadata,
        Item: undefined,
      });

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByBrandIdAndName", () => {
    it("should return offer when found", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockOffer],
      });

      const result = await repository.findByBrandIdAndName(
        "brand-123",
        "Summer Sale"
      );

      expect(dynamoDBService.query).toHaveBeenCalledWith(Tables.OFFERS, {
        IndexName: "brandId-name-index",
        KeyConditionExpression: "brandId = :brandId AND #name = :name",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: {
          ":brandId": "brand-123",
          ":name": "Summer Sale",
        },
      });
      expect(result).toBeInstanceOf(Offer);
    });

    it("should return null when no offer found", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [],
      });

      const result = await repository.findByBrandIdAndName(
        "brand-123",
        "nonexistent"
      );

      expect(result).toBeNull();
    });

    it("should return null when Items is undefined", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: undefined,
      });

      const result = await repository.findByBrandIdAndName(
        "brand-123",
        "nonexistent"
      );

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an offer and return it as instance", async () => {
      const updatedOffer = { ...mockOffer, name: "Updated Name" };
      dynamoDBService.put.mockResolvedValue({ $metadata: mockMetadata });

      const result = await repository.update(updatedOffer);

      expect(dynamoDBService.put).toHaveBeenCalledWith(Tables.OFFERS, {
        Item: updatedOffer,
      });
      expect(result).toBeInstanceOf(Offer);
      expect(result.name).toBe("Updated Name");
    });
  });

  describe("delete", () => {
    it("should delete an offer by id", async () => {
      dynamoDBService.delete.mockResolvedValue({ $metadata: mockMetadata });

      await repository.delete(mockOffer.id);

      expect(dynamoDBService.delete).toHaveBeenCalledWith(Tables.OFFERS, {
        Key: { id: mockOffer.id },
      });
    });
  });

  describe("incrementLocationsTotal", () => {
    it("should increment locationsTotal", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.incrementLocationsTotal("offer-123");

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.OFFERS, {
        Key: { id: "offer-123" },
        UpdateExpression:
          "SET locationsTotal = locationsTotal + :inc, updatedAt = :now",
        ExpressionAttributeValues: expect.objectContaining({
          ":inc": 1,
        }),
      });
    });
  });

  describe("decrementLocationsTotal", () => {
    it("should decrement locationsTotal with condition", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.decrementLocationsTotal("offer-123");

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.OFFERS, {
        Key: { id: "offer-123" },
        UpdateExpression:
          "SET locationsTotal = locationsTotal - :dec, updatedAt = :now",
        ConditionExpression: "locationsTotal > :zero",
        ExpressionAttributeValues: expect.objectContaining({
          ":dec": 1,
          ":zero": 0,
        }),
      });
    });
  });

  describe("addLocationToSet", () => {
    it("should add location to offer locationIds set", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.addLocationToSet("offer-123", "loc-456");

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.OFFERS, {
        Key: { id: "offer-123" },
        UpdateExpression:
          "ADD locationIds :locationId SET locationsTotal = locationsTotal + :inc, updatedAt = :now",
        ExpressionAttributeValues: expect.objectContaining({
          ":locationId": new Set(["loc-456"]),
          ":inc": 1,
        }),
      });
    });
  });

  describe("removeLocationFromSet", () => {
    it("should remove location from offer locationIds set", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.removeLocationFromSet("offer-123", "loc-456");

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.OFFERS, {
        Key: { id: "offer-123" },
        UpdateExpression:
          "DELETE locationIds :locationId SET locationsTotal = locationsTotal - :dec, updatedAt = :now",
        ConditionExpression: "locationsTotal > :zero",
        ExpressionAttributeValues: expect.objectContaining({
          ":locationId": new Set(["loc-456"]),
          ":dec": 1,
          ":zero": 0,
        }),
      });
    });
  });
});
