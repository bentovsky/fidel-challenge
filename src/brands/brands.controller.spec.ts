import { Test, TestingModule } from "@nestjs/testing";
import { BrandsController } from "./brands.controller";
import { BrandsService } from "./brands.service";
import { Brand } from "../dynamodb/entities";

describe("BrandsController", () => {
  let controller: BrandsController;
  let service: jest.Mocked<BrandsService>;

  const mockBrand: Brand = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Starbucks",
    nameLower: "starbucks",
    description: "Coffee company",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrandsController],
      providers: [
        {
          provide: BrandsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<BrandsController>(BrandsController);
    service = module.get(BrandsService);
  });

  describe("findAll", () => {
    it("should return paginated brands", async () => {
      const paginatedResult = {
        items: [mockBrand],
        nextCursor: "abc123",
      };
      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({ limit: 10, cursor: undefined });

      expect(service.findAll).toHaveBeenCalledWith(10, undefined);
      expect(result).toEqual(paginatedResult);
    });

    it("should pass query parameters to service", async () => {
      const paginatedResult = { items: [], nextCursor: undefined };
      service.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll({ limit: 5, cursor: "cursor123" });

      expect(service.findAll).toHaveBeenCalledWith(5, "cursor123");
    });
  });

  describe("create", () => {
    const createBrandDto = {
      name: "Starbucks",
      description: "Coffee company",
    };

    it("should create a new brand", async () => {
      service.create.mockResolvedValue(mockBrand);

      const result = await controller.create(createBrandDto);

      expect(service.create).toHaveBeenCalledWith(createBrandDto);
      expect(result).toEqual(mockBrand);
    });
  });

  describe("findOne", () => {
    it("should return a brand by id", async () => {
      service.findOne.mockResolvedValue(mockBrand);

      const result = await controller.findOne(mockBrand.id);

      expect(service.findOne).toHaveBeenCalledWith(mockBrand.id);
      expect(result).toEqual(mockBrand);
    });
  });

  describe("update", () => {
    const updateBrandDto = {
      name: "Starbucks Coffee",
      description: "Updated description",
    };

    it("should update a brand", async () => {
      const updatedBrand = { ...mockBrand, ...updateBrandDto };
      service.update.mockResolvedValue(updatedBrand);

      const result = await controller.update(mockBrand.id, updateBrandDto);

      expect(service.update).toHaveBeenCalledWith(mockBrand.id, updateBrandDto);
      expect(result).toEqual(updatedBrand);
    });
  });

  describe("remove", () => {
    it("should delete a brand", async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockBrand.id);

      expect(service.remove).toHaveBeenCalledWith(mockBrand.id);
    });
  });
});
