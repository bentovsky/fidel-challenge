import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { BrandsRepository } from "./brands.repository";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { Brand } from "../dynamodb/entities";

describe("BrandsRepository", () => {
  let repository: BrandsRepository;
  let dynamoDBService: jest.Mocked<DynamoDBService>;

  const mockMetadata = { httpStatusCode: 200, requestId: "test", attempts: 1, totalRetryDelay: 0 };

  const mockBrand: Brand = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Starbucks",
    nameLower: "starbucks",
    description: "Coffee company",
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsRepository,
        {
          provide: DynamoDBService,
          useValue: mockDynamoDBService,
        },
      ],
    }).compile();

    repository = module.get<BrandsRepository>(BrandsRepository);
    dynamoDBService = module.get(DynamoDBService);
  });

  describe("findAll", () => {
    it("should return paginated brands", async () => {
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockBrand],
        LastEvaluatedKey: { id: "next-key" },
      });

      const result = await repository.findAll(10);

      expect(dynamoDBService.scan).toHaveBeenCalledWith(Tables.BRANDS, {
        Limit: 10,
        ExclusiveStartKey: undefined,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Brand);
      expect(result.nextCursor).toBeDefined();
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
      dynamoDBService.scan.mockResolvedValue({ $metadata: mockMetadata, Items: [] });

      await repository.findAll(10, encodedCursor);

      expect(dynamoDBService.scan).toHaveBeenCalledWith(Tables.BRANDS, {
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
        Items: [mockBrand],
        LastEvaluatedKey: lastKey,
      });

      const result = await repository.findAll(10);

      const decodedCursor = JSON.parse(
        Buffer.from(result.nextCursor!, "base64").toString()
      );
      expect(decodedCursor).toEqual(lastKey);
    });

    it("should return undefined nextCursor when no more pages", async () => {
      dynamoDBService.scan.mockResolvedValue({
        $metadata: mockMetadata,
        Items: [mockBrand],
        LastEvaluatedKey: undefined,
      });

      const result = await repository.findAll(10);

      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("create", () => {
    it("should create a brand and return it as instance", async () => {
      dynamoDBService.put.mockResolvedValue({ $metadata: mockMetadata });

      const result = await repository.create(mockBrand);

      expect(dynamoDBService.put).toHaveBeenCalledWith(Tables.BRANDS, {
        Item: mockBrand,
      });
      expect(result).toBeInstanceOf(Brand);
      expect(result.id).toBe(mockBrand.id);
    });
  });

  describe("findById", () => {
    it("should return brand when found", async () => {
      dynamoDBService.get.mockResolvedValue({ $metadata: mockMetadata, Item: mockBrand });

      const result = await repository.findById(mockBrand.id);

      expect(dynamoDBService.get).toHaveBeenCalledWith(Tables.BRANDS, {
        Key: { id: mockBrand.id },
      });
      expect(result).toBeInstanceOf(Brand);
      expect(result?.id).toBe(mockBrand.id);
    });

    it("should return null when brand not found", async () => {
      dynamoDBService.get.mockResolvedValue({ $metadata: mockMetadata, Item: undefined });

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByNameLower", () => {
    it("should return brand when found by nameLower", async () => {
      dynamoDBService.query.mockResolvedValue({ $metadata: mockMetadata, Items: [mockBrand] });

      const result = await repository.findByNameLower("starbucks");

      expect(dynamoDBService.query).toHaveBeenCalledWith(Tables.BRANDS, {
        IndexName: "nameLower-index",
        KeyConditionExpression: "nameLower = :nameLower",
        ExpressionAttributeValues: { ":nameLower": "starbucks" },
      });
      expect(result).toBeInstanceOf(Brand);
      expect(result?.nameLower).toBe("starbucks");
    });

    it("should return null when no brand found", async () => {
      dynamoDBService.query.mockResolvedValue({ $metadata: mockMetadata, Items: [] });

      const result = await repository.findByNameLower("nonexistent");

      expect(result).toBeNull();
    });

    it("should return null when Items is undefined", async () => {
      dynamoDBService.query.mockResolvedValue({ $metadata: mockMetadata, Items: undefined });

      const result = await repository.findByNameLower("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a brand and return it as instance", async () => {
      const updatedBrand = { ...mockBrand, name: "Updated Name" };
      dynamoDBService.put.mockResolvedValue({ $metadata: mockMetadata });

      const result = await repository.update(updatedBrand);

      expect(dynamoDBService.put).toHaveBeenCalledWith(Tables.BRANDS, {
        Item: updatedBrand,
      });
      expect(result).toBeInstanceOf(Brand);
      expect(result.name).toBe("Updated Name");
    });
  });

  describe("delete", () => {
    it("should delete a brand by id", async () => {
      dynamoDBService.delete.mockResolvedValue({ $metadata: mockMetadata });

      await repository.delete(mockBrand.id);

      expect(dynamoDBService.delete).toHaveBeenCalledWith(Tables.BRANDS, {
        Key: { id: mockBrand.id },
      });
    });
  });
});
