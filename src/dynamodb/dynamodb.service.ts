import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
  GetCommandInput,
  PutCommandInput,
  QueryCommandInput,
  ScanCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

/**
 * DynamoDB table names used in the application.
 */
export const Tables = {
  BRANDS: "brands",
  OFFERS: "offers",
  LOCATIONS: "locations",
} as const;

/**
 * Type representing valid DynamoDB table names.
 */
export type TableName = (typeof Tables)[keyof typeof Tables];

/**
 * Service for interacting with AWS DynamoDB.
 * Provides a wrapper around the AWS SDK DynamoDB Document Client with
 * convenience methods for common operations.
 *
 * Automatically configures the client based on environment:
 * - Development: Uses local DynamoDB endpoint if configured
 * - Production: Uses AWS DynamoDB service
 *
 * @class DynamoDBService
 * @implements {OnModuleInit}
 */
@Injectable()
export class DynamoDBService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDBService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly client: DynamoDBDocumentClient;

  /**
   * Creates an instance of DynamoDBService.
   *
   * @param {ConfigService} configService - NestJS configuration service for accessing environment variables
   */
  constructor(private readonly configService: ConfigService) {
    const isLocal =
      this.configService.get<string>("NODE_ENV") === "development";

    const region =
      this.configService.get<string>("AWS_REGION") || process.env.AWS_REGION;
    const endpoint = this.configService.get<string>("DYNAMODB_ENDPOINT");

    this.dynamoClient = new DynamoDBClient(
      isLocal && endpoint
        ? { region, endpoint }
        : { region }
    );

    this.client = DynamoDBDocumentClient.from(this.dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  /**
   * Lifecycle hook called when the module is initialized.
   * Verifies the DynamoDB connection by listing tables.
   *
   * @throws {Error} If the connection to DynamoDB fails
   */
  async onModuleInit() {
    try {
      await this.dynamoClient.send(new ListTablesCommand({}));
      this.logger.log("DynamoDB connection established");
    } catch (error) {
      this.logger.error("Failed to connect to DynamoDB", error);
      throw new Error("Failed to connect to DynamoDB");
    }
  }

  /**
   * Retrieves a single item from a DynamoDB table by its primary key.
   *
   * @param {TableName} tableName - The name of the table to query
   * @param {Omit<GetCommandInput, "TableName">} params - Get command parameters (Key is required)
   * @returns {Promise<GetCommandOutput>} Promise resolving to the get command response
   */
  async get(tableName: TableName, params: Omit<GetCommandInput, "TableName">) {
    return this.client.send(
      new GetCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  /**
   * Creates or replaces an item in a DynamoDB table.
   *
   * @param {TableName} tableName - The name of the table to write to
   * @param {Omit<PutCommandInput, "TableName">} params - Put command parameters (Item is required)
   * @returns {Promise<PutCommandOutput>} Promise resolving to the put command response
   */
  async put(tableName: TableName, params: Omit<PutCommandInput, "TableName">) {
    return this.client.send(
      new PutCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  /**
   * Queries items from a DynamoDB table using the partition key and optionally the sort key.
   * More efficient than scan for retrieving specific items.
   *
   * @param {TableName} tableName - The name of the table to query
   * @param {Omit<QueryCommandInput, "TableName">} params - Query command parameters (KeyConditionExpression is typically required)
   * @returns {Promise<QueryCommandOutput>} Promise resolving to the query command response
   */
  async query(
    tableName: TableName,
    params: Omit<QueryCommandInput, "TableName">
  ) {
    return this.client.send(
      new QueryCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  /**
   * Updates an existing item in a DynamoDB table, or creates it if it doesn't exist.
   *
   * @param {TableName} tableName - The name of the table to update
   * @param {Omit<UpdateCommandInput, "TableName">} params - Update command parameters (Key and UpdateExpression are required)
   * @returns {Promise<UpdateCommandOutput>} Promise resolving to the update command response
   */
  async update(
    tableName: TableName,
    params: Omit<UpdateCommandInput, "TableName">
  ) {
    return this.client.send(
      new UpdateCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  /**
   * Deletes a single item from a DynamoDB table by its primary key.
   *
   * @param {TableName} tableName - The name of the table to delete from
   * @param {Omit<DeleteCommandInput, "TableName">} params - Delete command parameters (Key is required)
   * @returns {Promise<DeleteCommandOutput>} Promise resolving to the delete command response
   */
  async delete(
    tableName: TableName,
    params: Omit<DeleteCommandInput, "TableName">
  ) {
    return this.client.send(
      new DeleteCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  /**
   * Scans all items in a DynamoDB table.
   * Note: Scan operations are less efficient than Query operations and should be used sparingly.
   * Consider using Query when possible.
   *
   * @param {TableName} tableName - The name of the table to scan
   * @param {Omit<ScanCommandInput, "TableName">} [params] - Optional scan command parameters for filtering and pagination
   * @returns {Promise<ScanCommandOutput>} Promise resolving to the scan command response
   */
  async scan(
    tableName: TableName,
    params?: Omit<ScanCommandInput, "TableName">
  ) {
    return this.client.send(
      new ScanCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  /**
   * Performs a transactional write operation across multiple tables.
   * All operations succeed or fail together (atomic operation).
   *
   * @param {TransactWriteCommandInput} params - Transaction write command parameters (TransactItems is required)
   * @returns {Promise<TransactWriteCommandOutput>} Promise resolving to the transaction write command response
   */
  async transactWrite(params: TransactWriteCommandInput) {
    return this.client.send(new TransactWriteCommand(params));
  }
}
