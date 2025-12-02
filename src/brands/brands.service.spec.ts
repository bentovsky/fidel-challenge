import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { BrandsService } from "./brands.service";
import { BrandsRepository } from "./brands.repository";
import { Brand } from "../dynamodb/entities";

describe("BrandsService", () => {
  let service: BrandsService;
  let repository: jest.Mocked<BrandsRepository>;

  const mockBrand: Brand = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Starbucks",
    nameLower: "starbucks",
    description: "Coffee company",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(async () => {
    const mockRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByNameLower: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        {
          provide: BrandsRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
    repository = module.get(BrandsRepository);
  });

  describe("findAll", () => {
    it("should return paginated brands", async () => {
      const paginatedResult = {
        items: [mockBrand],
        nextCursor: "abc123",
      };
      repository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll(10, undefined);

      expect(repository.findAll).toHaveBeenCalledWith(10, undefined);
      expect(result).toEqual(paginatedResult);
    });

    it("should use default page size when limit is not provided", async () => {
      const paginatedResult = { items: [], nextCursor: undefined };
      repository.findAll.mockResolvedValue(paginatedResult);

      await service.findAll(undefined, undefined);

      expect(repository.findAll).toHaveBeenCalledWith(10, undefined);
    });

    it("should pass cursor for pagination", async () => {
      const paginatedResult = { items: [mockBrand], nextCursor: undefined };
      repository.findAll.mockResolvedValue(paginatedResult);

      await service.findAll(5, "cursor123");

      expect(repository.findAll).toHaveBeenCalledWith(5, "cursor123");
    });
  });

  describe("create", () => {
    const createBrandDto = {
      name: "Starbucks",
      description: "Coffee company",
    };

    it("should create a new brand", async () => {
      repository.findByNameLower.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockBrand);

      const result = await service.create(createBrandDto);

      expect(repository.findByNameLower).toHaveBeenCalledWith("starbucks");
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Starbucks",
          nameLower: "starbucks",
          description: "Coffee company",
        })
      );
      expect(result).toEqual(mockBrand);
    });

    it("should throw ConflictException if brand name already exists", async () => {
      repository.findByNameLower.mockResolvedValue(mockBrand);

      await expect(service.create(createBrandDto)).rejects.toThrow(
        ConflictException
      );
      await expect(service.create(createBrandDto)).rejects.toThrow(
        'Brand with name "Starbucks" already exists'
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should handle case-insensitive name uniqueness", async () => {
      repository.findByNameLower.mockResolvedValue(mockBrand);

      await expect(
        service.create({ name: "STARBUCKS", description: "Test" })
      ).rejects.toThrow(ConflictException);

      expect(repository.findByNameLower).toHaveBeenCalledWith("starbucks");
    });

    it("should generate id and timestamps for new brand", async () => {
      repository.findByNameLower.mockResolvedValue(null);
      repository.create.mockImplementation(async (brand) => brand);

      const result = await service.create(createBrandDto);

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe("findOne", () => {
    it("should return a brand by id", async () => {
      repository.findById.mockResolvedValue(mockBrand);

      const result = await service.findOne(mockBrand.id);

      expect(repository.findById).toHaveBeenCalledWith(mockBrand.id);
      expect(result).toEqual(mockBrand);
    });

    it("should throw NotFoundException if brand not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        "Brand with id non-existent-id not found"
      );
    });
  });

  describe("update", () => {
    const updateBrandDto = {
      name: "Starbucks Coffee",
      description: "Updated description",
    };

    it("should update a brand", async () => {
      repository.findById.mockResolvedValue(mockBrand);
      repository.findByNameLower.mockResolvedValue(null);
      repository.update.mockImplementation(async (brand) => brand);

      const result = await service.update(mockBrand.id, updateBrandDto);

      expect(result.name).toBe("Starbucks Coffee");
      expect(result.nameLower).toBe("starbucks coffee");
      expect(result.description).toBe("Updated description");
    });

    it("should throw NotFoundException if brand not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update("non-existent-id", updateBrandDto)
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if new name conflicts with existing brand", async () => {
      const anotherBrand = { ...mockBrand, id: "different-id" };
      repository.findById.mockResolvedValue(mockBrand);
      repository.findByNameLower.mockResolvedValue(anotherBrand);

      await expect(
        service.update(mockBrand.id, { name: "ExistingBrand" })
      ).rejects.toThrow(ConflictException);
    });

    it("should allow updating to same name (no conflict)", async () => {
      repository.findById.mockResolvedValue(mockBrand);
      repository.update.mockImplementation(async (brand) => brand);

      const result = await service.update(mockBrand.id, { name: "Starbucks" });

      expect(repository.findByNameLower).not.toHaveBeenCalled();
      expect(result.name).toBe("Starbucks");
    });

    it("should update only provided fields", async () => {
      repository.findById.mockResolvedValue(mockBrand);
      repository.update.mockImplementation(async (brand) => brand);

      const result = await service.update(mockBrand.id, {
        description: "New description",
      });

      expect(result.name).toBe(mockBrand.name);
      expect(result.description).toBe("New description");
    });

    it("should update the updatedAt timestamp", async () => {
      repository.findById.mockResolvedValue(mockBrand);
      repository.update.mockImplementation(async (brand) => brand);

      const result = await service.update(mockBrand.id, {
        description: "New description",
      });

      expect(result.updatedAt).not.toBe(mockBrand.updatedAt);
    });
  });

  describe("remove", () => {
    it("should delete a brand", async () => {
      repository.findById.mockResolvedValue(mockBrand);
      repository.delete.mockResolvedValue(undefined);

      await service.remove(mockBrand.id);

      expect(repository.findById).toHaveBeenCalledWith(mockBrand.id);
      expect(repository.delete).toHaveBeenCalledWith(mockBrand.id);
    });

    it("should throw NotFoundException if brand not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
