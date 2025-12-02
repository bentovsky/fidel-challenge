import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { LocationsRepository } from "./locations.repository";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { Location } from "../dynamodb/entities";

describe("LocationsRepository", () => {
  let repository: LocationsRepository;
  let dynamoDBService: jest.Mocked<DynamoDBService>;

  const mockMetadata = {
    httpStatusCode: 200,
    requestId: "test",
    attempts: 1,
    totalRetryDelay: 0,
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
        LocationsRepository,
        {
          provide: DynamoDBService,
          useValue: mockDynamoDBService,
        },
      ],
    }).compile();

    repository = module.get<LocationsRepository>(LocationsRepository);
    dynamoDBService = module.get(DynamoDBService);
  });

  describe("findAll", () => {
    it("should return paginated locations using scan when no brandId", async () => {
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockLocation],
        LastEvaluatedKey: { id: "next-key" },
      });

      const result = await repository.findAll(10);

      expect(dynamoDBService.scan).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Limit: 10,
        ExclusiveStartKey: undefined,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Location);
      expect(result.nextCursor).toBeDefined();
    });

    it("should return paginated locations using query when brandId provided", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockLocation],
        LastEvaluatedKey: { id: "next-key", brandId: "brand-123" },
      });

      const result = await repository.findAll(10, undefined, "brand-123");

      expect(dynamoDBService.query).toHaveBeenCalledWith(Tables.LOCATIONS, {
        IndexName: "brandId-name-index",
        KeyConditionExpression: "brandId = :brandId",
        ExpressionAttributeValues: { ":brandId": "brand-123" },
        Limit: 10,
        ExclusiveStartKey: undefined,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Location);
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

      expect(dynamoDBService.scan).toHaveBeenCalledWith(Tables.LOCATIONS, {
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
        Items: [mockLocation],
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
    it("should create a location and return it as instance", async () => {
      dynamoDBService.put.mockResolvedValue({ $metadata: mockMetadata });

      const result = await repository.create(mockLocation);

      expect(dynamoDBService.put).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Item: mockLocation,
      });
      expect(result).toBeInstanceOf(Location);
      expect(result.id).toBe(mockLocation.id);
    });
  });

  describe("findById", () => {
    it("should return location when found", async () => {
      dynamoDBService.get.mockResolvedValue({
        $metadata: mockMetadata,
        Item: mockLocation,
      });

      const result = await repository.findById(mockLocation.id);

      expect(dynamoDBService.get).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Key: { id: mockLocation.id },
      });
      expect(result).toBeInstanceOf(Location);
      expect(result?.id).toBe(mockLocation.id);
    });

    it("should return null when location not found", async () => {
      dynamoDBService.get.mockResolvedValue({
        $metadata: mockMetadata,
        Item: undefined,
      });

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByBrandIdAndName", () => {
    it("should return location when found", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockLocation],
      });

      const result = await repository.findByBrandIdAndName(
        "brand-123",
        "Oxford Street"
      );

      expect(dynamoDBService.query).toHaveBeenCalledWith(Tables.LOCATIONS, {
        IndexName: "brandId-name-index",
        KeyConditionExpression: "brandId = :brandId AND #name = :name",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: {
          ":brandId": "brand-123",
          ":name": "Oxford Street",
        },
      });
      expect(result).toBeInstanceOf(Location);
    });

    it("should return null when no location found", async () => {
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

  describe("findByBrandIdAndNameLower", () => {
    it("should return location when found", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockLocation],
      });

      const result = await repository.findByBrandIdAndNameLower(
        "brand-123",
        "oxford street"
      );

      expect(dynamoDBService.query).toHaveBeenCalledWith(Tables.LOCATIONS, {
        IndexName: "brandId-nameLower-index",
        KeyConditionExpression: "brandId = :brandId AND nameLower = :nameLower",
        ExpressionAttributeValues: {
          ":brandId": "brand-123",
          ":nameLower": "oxford street",
        },
      });
      expect(result).toBeInstanceOf(Location);
    });

    it("should return null when no location found", async () => {
      dynamoDBService.query.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [],
      });

      const result = await repository.findByBrandIdAndNameLower(
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

      const result = await repository.findByBrandIdAndNameLower(
        "brand-123",
        "nonexistent"
      );

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a location and return it as instance", async () => {
      const updatedLocation = { ...mockLocation, name: "Updated Name" };
      dynamoDBService.put.mockResolvedValue({ $metadata: mockMetadata });

      const result = await repository.update(updatedLocation);

      expect(dynamoDBService.put).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Item: updatedLocation,
      });
      expect(result).toBeInstanceOf(Location);
      expect(result.name).toBe("Updated Name");
    });
  });

  describe("delete", () => {
    it("should delete a location by id", async () => {
      dynamoDBService.delete.mockResolvedValue({ $metadata: mockMetadata });

      await repository.delete(mockLocation.id);

      expect(dynamoDBService.delete).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Key: { id: mockLocation.id },
      });
    });
  });

  describe("addOfferToSet", () => {
    it("should add offer to location offerIds set", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.addOfferToSet("loc-123", "offer-456");

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Key: { id: "loc-123" },
        UpdateExpression:
          "ADD offerIds :offerId SET hasOffer = :hasOffer, updatedAt = :now",
        ExpressionAttributeValues: expect.objectContaining({
          ":offerId": new Set(["offer-456"]),
          ":hasOffer": true,
        }),
      });
    });
  });

  describe("removeOfferFromSet", () => {
    it("should remove offer from location offerIds set", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.removeOfferFromSet("loc-123", "offer-456");

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Key: { id: "loc-123" },
        UpdateExpression: "DELETE offerIds :offerId SET updatedAt = :now",
        ExpressionAttributeValues: expect.objectContaining({
          ":offerId": new Set(["offer-456"]),
        }),
      });
    });
  });

  describe("updateHasOffer", () => {
    it("should update hasOffer flag to true", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.updateHasOffer("loc-123", true);

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Key: { id: "loc-123" },
        UpdateExpression: "SET hasOffer = :hasOffer, updatedAt = :now",
        ExpressionAttributeValues: expect.objectContaining({
          ":hasOffer": true,
        }),
      });
    });

    it("should update hasOffer flag to false", async () => {
      dynamoDBService.update.mockResolvedValue({ $metadata: mockMetadata });

      await repository.updateHasOffer("loc-123", false);

      expect(dynamoDBService.update).toHaveBeenCalledWith(Tables.LOCATIONS, {
        Key: { id: "loc-123" },
        UpdateExpression: "SET hasOffer = :hasOffer, updatedAt = :now",
        ExpressionAttributeValues: expect.objectContaining({
          ":hasOffer": false,
        }),
      });
    });
  });
});
