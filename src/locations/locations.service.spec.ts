import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { LocationsService } from "./locations.service";
import { LocationsRepository } from "./locations.repository";
import { BrandsService } from "../brands/brands.service";
import { Location } from "../dynamodb/entities";
import { Brand } from "../dynamodb/entities";

describe("LocationsService", () => {
  let service: LocationsService;
  let repository: jest.Mocked<LocationsRepository>;
  let brandsService: jest.Mocked<BrandsService>;

  const mockBrand: Brand = {
    id: "brand-123",
    name: "Starbucks",
    nameLower: "starbucks",
    description: "Coffee company",
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
      findByBrandIdAndNameLower: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockBrandsService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: LocationsRepository, useValue: mockRepository },
        { provide: BrandsService, useValue: mockBrandsService },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    repository = module.get(LocationsRepository);
    brandsService = module.get(BrandsService);
  });

  describe("findAll", () => {
    it("should return paginated locations for a brand", async () => {
      const paginatedResult = {
        items: [mockLocation],
        nextCursor: "abc123",
      };
      repository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll("brand-123", 10, undefined);

      expect(repository.findAll).toHaveBeenCalledWith(10, undefined, "brand-123");
      expect(result).toEqual(paginatedResult);
    });

    it("should use default page size when limit is not provided", async () => {
      const paginatedResult = { items: [], nextCursor: undefined };
      repository.findAll.mockResolvedValue(paginatedResult);

      await service.findAll("brand-123", undefined, undefined);

      expect(repository.findAll).toHaveBeenCalledWith(10, undefined, "brand-123");
    });

    it("should pass cursor for pagination", async () => {
      const paginatedResult = { items: [mockLocation], nextCursor: undefined };
      repository.findAll.mockResolvedValue(paginatedResult);

      await service.findAll("brand-123", 5, "cursor123");

      expect(repository.findAll).toHaveBeenCalledWith(5, "cursor123", "brand-123");
    });
  });

  describe("create", () => {
    const createLocationDto = {
      brandId: "brand-123",
      name: "Oxford Street",
      address: "123 Oxford Street, London",
    };

    it("should create a new location", async () => {
      brandsService.findOne.mockResolvedValue(mockBrand);
      repository.findByBrandIdAndNameLower.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockLocation);

      const result = await service.create(createLocationDto);

      expect(brandsService.findOne).toHaveBeenCalledWith("brand-123");
      expect(repository.findByBrandIdAndNameLower).toHaveBeenCalledWith(
        "brand-123",
        "oxford street"
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          brandId: "brand-123",
          name: "Oxford Street",
          nameLower: "oxford street",
          address: "123 Oxford Street, London",
          hasOffer: false,
        })
      );
      expect(result).toEqual(mockLocation);
    });

    it("should throw NotFoundException if brand doesn't exist", async () => {
      brandsService.findOne.mockRejectedValue(
        new NotFoundException("Brand not found")
      );

      await expect(service.create(createLocationDto)).rejects.toThrow(
        NotFoundException
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should throw ConflictException if location name already exists for brand (case-insensitive)", async () => {
      brandsService.findOne.mockResolvedValue(mockBrand);
      repository.findByBrandIdAndNameLower.mockResolvedValue(mockLocation);

      await expect(service.create(createLocationDto)).rejects.toThrow(
        ConflictException
      );
      await expect(service.create(createLocationDto)).rejects.toThrow(
        'Location with name "Oxford Street" already exists for this brand'
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should generate id, nameLower and timestamps for new location", async () => {
      brandsService.findOne.mockResolvedValue(mockBrand);
      repository.findByBrandIdAndNameLower.mockResolvedValue(null);
      repository.create.mockImplementation(async (location) => location);

      const result = await service.create(createLocationDto);

      expect(result.id).toBeDefined();
      expect(result.nameLower).toBe("oxford street");
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(result.hasOffer).toBe(false);
    });
  });

  describe("findOne", () => {
    it("should return a location by id", async () => {
      repository.findById.mockResolvedValue(mockLocation);

      const result = await service.findOne(mockLocation.id);

      expect(repository.findById).toHaveBeenCalledWith(mockLocation.id);
      expect(result).toEqual(mockLocation);
    });

    it("should throw NotFoundException if location not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.findOne("non-existent-id")).rejects.toThrow(
        "Location with id non-existent-id not found"
      );
    });
  });

  describe("update", () => {
    const updateLocationDto = {
      name: "New Oxford Street",
      address: "456 Oxford Street, London",
    };

    it("should update a location", async () => {
      repository.findById.mockResolvedValue(mockLocation);
      repository.findByBrandIdAndNameLower.mockResolvedValue(null);
      repository.update.mockImplementation(async (location) => location);

      const result = await service.update(mockLocation.id, updateLocationDto);

      expect(result.name).toBe("New Oxford Street");
      expect(result.nameLower).toBe("new oxford street");
      expect(result.address).toBe("456 Oxford Street, London");
    });

    it("should throw NotFoundException if location not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update("non-existent-id", updateLocationDto)
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if new name conflicts with existing location (case-insensitive)", async () => {
      const anotherLocation = { ...mockLocation, id: "different-id" };
      repository.findById.mockResolvedValue(mockLocation);
      repository.findByBrandIdAndNameLower.mockResolvedValue(anotherLocation);

      await expect(
        service.update(mockLocation.id, { name: "Existing Location" })
      ).rejects.toThrow(ConflictException);
    });

    it("should allow updating to same name with different casing (no conflict check)", async () => {
      repository.findById.mockResolvedValue(mockLocation);
      repository.update.mockImplementation(async (location) => location);

      const result = await service.update(mockLocation.id, {
        name: "OXFORD STREET",
      });

      expect(repository.findByBrandIdAndNameLower).not.toHaveBeenCalled();
      expect(result.name).toBe("OXFORD STREET");
      expect(result.nameLower).toBe(mockLocation.nameLower);
    });

    it("should update only provided fields", async () => {
      repository.findById.mockResolvedValue(mockLocation);
      repository.update.mockImplementation(async (location) => location);

      const result = await service.update(mockLocation.id, {
        address: "New Address",
      });

      expect(result.name).toBe(mockLocation.name);
      expect(result.address).toBe("New Address");
    });

    it("should update the updatedAt timestamp", async () => {
      repository.findById.mockResolvedValue(mockLocation);
      repository.update.mockImplementation(async (location) => location);

      const result = await service.update(mockLocation.id, {
        address: "New Address",
      });

      expect(result.updatedAt).not.toBe(mockLocation.updatedAt);
    });
  });

  describe("remove", () => {
    it("should delete a location", async () => {
      repository.findById.mockResolvedValue(mockLocation);
      repository.delete.mockResolvedValue(undefined);

      await service.remove(mockLocation.id);

      expect(repository.findById).toHaveBeenCalledWith(mockLocation.id);
      expect(repository.delete).toHaveBeenCalledWith(mockLocation.id);
    });

    it("should throw NotFoundException if location not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
