import { Test, TestingModule } from "@nestjs/testing";
import { LocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";
import { Location } from "../dynamodb/entities";

describe("LocationsController", () => {
  let controller: LocationsController;
  let service: jest.Mocked<LocationsService>;

  const mockLocation: Location = {
    id: "loc-123",
    brandId: "brand-123",
    name: "Oxford Street",
    address: "123 Oxford Street, London",
    hasOffer: false,
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
      controllers: [LocationsController],
      providers: [
        {
          provide: LocationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
    service = module.get(LocationsService);
  });

  describe("findAll", () => {
    it("should return paginated locations", async () => {
      const paginatedResult = {
        items: [mockLocation],
        nextCursor: "abc123",
      };
      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({
        limit: 10,
        cursor: undefined,
        brandId: undefined,
      });

      expect(service.findAll).toHaveBeenCalledWith(10, undefined, undefined);
      expect(result).toEqual(paginatedResult);
    });

    it("should pass query parameters to service", async () => {
      const paginatedResult = { items: [], nextCursor: undefined };
      service.findAll.mockResolvedValue(paginatedResult);

      await controller.findAll({
        limit: 5,
        cursor: "cursor123",
        brandId: "brand-123",
      });

      expect(service.findAll).toHaveBeenCalledWith(5, "cursor123", "brand-123");
    });
  });

  describe("findOne", () => {
    it("should return a location by id", async () => {
      service.findOne.mockResolvedValue(mockLocation);

      const result = await controller.findOne(mockLocation.id);

      expect(service.findOne).toHaveBeenCalledWith(mockLocation.id);
      expect(result).toEqual(mockLocation);
    });
  });

  describe("create", () => {
    const createLocationDto = {
      brandId: "brand-123",
      name: "Oxford Street",
      address: "123 Oxford Street, London",
    };

    it("should create a new location", async () => {
      service.create.mockResolvedValue(mockLocation);

      const result = await controller.create(createLocationDto);

      expect(service.create).toHaveBeenCalledWith(createLocationDto);
      expect(result).toEqual(mockLocation);
    });
  });

  describe("update", () => {
    const updateLocationDto = {
      name: "New Oxford Street",
      address: "456 Oxford Street, London",
    };

    it("should update a location", async () => {
      const updatedLocation = { ...mockLocation, ...updateLocationDto };
      service.update.mockResolvedValue(updatedLocation);

      const result = await controller.update(mockLocation.id, updateLocationDto);

      expect(service.update).toHaveBeenCalledWith(
        mockLocation.id,
        updateLocationDto
      );
      expect(result).toEqual(updatedLocation);
    });
  });

  describe("remove", () => {
    it("should delete a location", async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockLocation.id);

      expect(service.remove).toHaveBeenCalledWith(mockLocation.id);
    });
  });
});
