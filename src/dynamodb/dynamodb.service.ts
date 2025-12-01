import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
  GetCommandInput,
  PutCommandInput,
  QueryCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

export const Tables = {
  BRANDS: "brands",
  OFFERS: "offers",
  LOCATIONS: "locations",
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];

@Injectable()
export class DynamoDBService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDBService.name);
  private readonly dynamoClient: DynamoDBClient;
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly configService: ConfigService) {
    const isLocal =
      this.configService.get<string>("NODE_ENV") === "development";

    const region = this.configService.getOrThrow<string>("AWS_REGION");
    const endpoint = this.configService.getOrThrow<string>("DYNAMODB_ENDPOINT");

    this.dynamoClient = new DynamoDBClient(
      isLocal
        ? { region, endpoint }
        : { region }
    );

    this.client = DynamoDBDocumentClient.from(this.dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.dynamoClient.send(new ListTablesCommand({}));
      this.logger.log("DynamoDB connection established");
    } catch (error) {
      this.logger.error("Failed to connect to DynamoDB", error);
      throw new Error("Failed to connect to DynamoDB");
    }
  }

  async get(tableName: TableName, params: Omit<GetCommandInput, "TableName">) {
    return this.client.send(
      new GetCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

  async put(tableName: TableName, params: Omit<PutCommandInput, "TableName">) {
    return this.client.send(
      new PutCommand({
        TableName: tableName,
        ...params,
      })
    );
  }

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

  async transactWrite(params: TransactWriteCommandInput) {
    return this.client.send(new TransactWriteCommand(params));
  }
}
