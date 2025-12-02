import { Test, TestingModule } from "@nestjs/testing";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";
import { Offer } from "../dynamodb/entities";

describe("OffersController", () => {
  let controller: OffersController;
  let service: jest.Mocked<OffersService>;

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
    const mockService = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      linkToLocation: jest.fn(),
      unlinkFromLocation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        {
          provide: OffersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<OffersController>(OffersController);
    service = module.get(OffersService);
  });

  describe("findAll", () => {
    it("should return paginated offers for a brand", async () => {
      const paginatedResult = {
        items: [mockOffer],
        nextCursor: "abc123",
      };
      service.findAll.mockResolvedValue(paginatedResult);

      const query = { brandId: "brand-123", limit: 10, cursor: undefined };
      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResult);
    });

    it("should pass query parameters to service", async () => {
      const paginatedResult = { items: [], nextCursor: undefined };
      service.findAll.mockResolvedValue(paginatedResult);

      const query = { brandId: "brand-123", limit: 5, cursor: "cursor123" };
      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe("findOne", () => {
    it("should return an offer by id", async () => {
      service.findOne.mockResolvedValue(mockOffer);

      const result = await controller.findOne(mockOffer.id);

      expect(service.findOne).toHaveBeenCalledWith(mockOffer.id);
      expect(result).toEqual(mockOffer);
    });
  });

  describe("create", () => {
    const createOfferDto = {
      brandId: "brand-123",
      name: "Summer Sale",
      description: "10% off",
    };

    it("should create a new offer", async () => {
      service.create.mockResolvedValue(mockOffer);

      const result = await controller.create(createOfferDto);

      expect(service.create).toHaveBeenCalledWith(createOfferDto);
      expect(result).toEqual(mockOffer);
    });
  });

  describe("update", () => {
    const updateOfferDto = {
      name: "Winter Sale",
      description: "20% off",
    };

    it("should update an offer", async () => {
      const updatedOffer = { ...mockOffer, ...updateOfferDto };
      service.update.mockResolvedValue(updatedOffer);

      const result = await controller.update(mockOffer.id, updateOfferDto);

      expect(service.update).toHaveBeenCalledWith(mockOffer.id, updateOfferDto);
      expect(result).toEqual(updatedOffer);
    });
  });

  describe("remove", () => {
    it("should delete an offer", async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(mockOffer.id);

      expect(service.remove).toHaveBeenCalledWith(mockOffer.id);
    });
  });

  describe("linkToLocation", () => {
    it("should link a location to an offer", async () => {
      const linkedOffer = { ...mockOffer, locationsTotal: 1 };
      service.linkToLocation.mockResolvedValue(linkedOffer);

      const result = await controller.linkToLocation("offer-123", "loc-123");

      expect(service.linkToLocation).toHaveBeenCalledWith("offer-123", "loc-123");
      expect(result).toEqual(linkedOffer);
    });
  });

  describe("unlinkFromLocation", () => {
    it("should unlink a location from an offer", async () => {
      service.unlinkFromLocation.mockResolvedValue(mockOffer);

      await controller.unlinkFromLocation("offer-123", "loc-123");

      expect(service.unlinkFromLocation).toHaveBeenCalledWith(
        "offer-123",
        "loc-123"
      );
    });
  });
});
