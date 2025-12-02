import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DynamoDBService, Tables } from "./dynamodb.service";

// Mock the AWS SDK
const mockSend = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ListTablesCommand: jest.fn().mockImplementation((params) => ({
    type: "ListTablesCommand",
    ...params,
  })),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  },
  GetCommand: jest.fn().mockImplementation((params) => ({
    type: "GetCommand",
    ...params,
  })),
  PutCommand: jest.fn().mockImplementation((params) => ({
    type: "PutCommand",
    ...params,
  })),
  QueryCommand: jest.fn().mockImplementation((params) => ({
    type: "QueryCommand",
    ...params,
  })),
  ScanCommand: jest.fn().mockImplementation((params) => ({
    type: "ScanCommand",
    ...params,
  })),
  UpdateCommand: jest.fn().mockImplementation((params) => ({
    type: "UpdateCommand",
    ...params,
  })),
  DeleteCommand: jest.fn().mockImplementation((params) => ({
    type: "DeleteCommand",
    ...params,
  })),
  TransactWriteCommand: jest.fn().mockImplementation((params) => ({
    type: "TransactWriteCommand",
    ...params,
  })),
}));

describe("DynamoDBService", () => {
  let service: DynamoDBService;
  let configService: jest.Mocked<ConfigService>;

  const mockMetadata = { httpStatusCode: 200, requestId: "test", attempts: 1, totalRetryDelay: 0 };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    // Default config values
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        NODE_ENV: "development",
        AWS_REGION: "eu-west-1",
        DYNAMODB_ENDPOINT: "http://localhost:8000",
      };
      return config[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamoDBService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DynamoDBService>(DynamoDBService);
    configService = module.get(ConfigService);
  });

  describe("constructor", () => {
    it("should create service with local config in development", () => {
      expect(configService.get).toHaveBeenCalledWith("NODE_ENV");
      expect(configService.get).toHaveBeenCalledWith("AWS_REGION");
      expect(configService.get).toHaveBeenCalledWith("DYNAMODB_ENDPOINT");
    });
  });

  describe("onModuleInit", () => {
    it("should successfully connect to DynamoDB", async () => {
      mockSend.mockResolvedValue({ TableNames: ["brands", "offers", "locations"] });

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it("should throw error when connection fails", async () => {
      mockSend.mockRejectedValue(new Error("Connection failed"));

      await expect(service.onModuleInit()).rejects.toThrow(
        "Failed to connect to DynamoDB"
      );
    });
  });

  describe("get", () => {
    it("should call send with GetCommand and correct parameters", async () => {
      const mockResponse = { $metadata: mockMetadata, Item: { id: "123" } };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.get(Tables.BRANDS, { Key: { id: "123" } });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GetCommand",
          TableName: "brands",
          Key: { id: "123" },
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("put", () => {
    it("should call send with PutCommand and correct parameters", async () => {
      const mockResponse = { $metadata: mockMetadata };
      const item = { id: "123", name: "Test" };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.put(Tables.BRANDS, { Item: item });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PutCommand",
          TableName: "brands",
          Item: item,
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("query", () => {
    it("should call send with QueryCommand and correct parameters", async () => {
      const mockResponse = { $metadata: mockMetadata, Items: [{ id: "123" }] };
      mockSend.mockResolvedValue(mockResponse);

      const params = {
        IndexName: "nameLower-index",
        KeyConditionExpression: "nameLower = :nameLower",
        ExpressionAttributeValues: { ":nameLower": "test" },
      };

      const result = await service.query(Tables.BRANDS, params);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "QueryCommand",
          TableName: "brands",
          ...params,
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("update", () => {
    it("should call send with UpdateCommand and correct parameters", async () => {
      const mockResponse = { $metadata: mockMetadata, Attributes: { id: "123" } };
      mockSend.mockResolvedValue(mockResponse);

      const params = {
        Key: { id: "123" },
        UpdateExpression: "SET #name = :name",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":name": "Updated" },
      };

      const result = await service.update(Tables.OFFERS, params);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "UpdateCommand",
          TableName: "offers",
          ...params,
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("delete", () => {
    it("should call send with DeleteCommand and correct parameters", async () => {
      const mockResponse = { $metadata: mockMetadata };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.delete(Tables.LOCATIONS, { Key: { id: "123" } });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DeleteCommand",
          TableName: "locations",
          Key: { id: "123" },
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("scan", () => {
    it("should call send with ScanCommand and correct parameters", async () => {
      const mockResponse = {
        $metadata: mockMetadata,
        Items: [{ id: "123" }],
        LastEvaluatedKey: { id: "123" },
      };
      mockSend.mockResolvedValue(mockResponse);

      const params = { Limit: 10 };
      const result = await service.scan(Tables.BRANDS, params);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ScanCommand",
          TableName: "brands",
          Limit: 10,
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("should work without optional params", async () => {
      const mockResponse = { $metadata: mockMetadata, Items: [] };
      mockSend.mockResolvedValue(mockResponse);

      const result = await service.scan(Tables.BRANDS);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ScanCommand",
          TableName: "brands",
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("transactWrite", () => {
    it("should call send with TransactWriteCommand and correct parameters", async () => {
      const mockResponse = { $metadata: mockMetadata };
      mockSend.mockResolvedValue(mockResponse);

      const params = {
        TransactItems: [
          {
            Update: {
              TableName: Tables.LOCATIONS,
              Key: { id: "loc-123" },
              UpdateExpression: "SET hasOffer = :hasOffer",
              ExpressionAttributeValues: { ":hasOffer": true },
            },
          },
          {
            Update: {
              TableName: Tables.OFFERS,
              Key: { id: "offer-123" },
              UpdateExpression: "SET locationsTotal = locationsTotal + :inc",
              ExpressionAttributeValues: { ":inc": 1 },
            },
          },
        ],
      };

      const result = await service.transactWrite(params);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TransactWriteCommand",
          TransactItems: params.TransactItems,
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("Tables constant", () => {
    it("should have correct table names", () => {
      expect(Tables.BRANDS).toBe("brands");
      expect(Tables.OFFERS).toBe("offers");
      expect(Tables.LOCATIONS).toBe("locations");
    });
  });
});
