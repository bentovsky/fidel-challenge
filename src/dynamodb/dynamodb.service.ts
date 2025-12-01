import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
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
} from '@aws-sdk/lib-dynamodb';

export const Tables = {
  BRANDS: 'brands',
  OFFERS: 'offers',
  LOCATIONS: 'locations',
  OFFER_LOCATIONS: 'offer-locations',
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];

@Injectable()
export class DynamoDBService {
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    const isLocal =
      process.env.IS_OFFLINE === 'true' ||
      process.env.NODE_ENV === 'development';

    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-west-1',
      ...(isLocal && {
        endpoint: 'http://localhost:8000',
        credentials: {
          accessKeyId: 'local',
          secretAccessKey: 'local',
        },
      }),
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  async get(tableName: TableName, params: Omit<GetCommandInput, 'TableName'>) {
    return this.client.send(
      new GetCommand({
        TableName: tableName,
        ...params,
      }),
    );
  }

  async put(tableName: TableName, params: Omit<PutCommandInput, 'TableName'>) {
    return this.client.send(
      new PutCommand({
        TableName: tableName,
        ...params,
      }),
    );
  }

  async query(
    tableName: TableName,
    params: Omit<QueryCommandInput, 'TableName'>,
  ) {
    return this.client.send(
      new QueryCommand({
        TableName: tableName,
        ...params,
      }),
    );
  }

  async update(
    tableName: TableName,
    params: Omit<UpdateCommandInput, 'TableName'>,
  ) {
    return this.client.send(
      new UpdateCommand({
        TableName: tableName,
        ...params,
      }),
    );
  }

  async delete(
    tableName: TableName,
    params: Omit<DeleteCommandInput, 'TableName'>,
  ) {
    return this.client.send(
      new DeleteCommand({
        TableName: tableName,
        ...params,
      }),
    );
  }

  async transactWrite(params: TransactWriteCommandInput) {
    return this.client.send(new TransactWriteCommand(params));
  }
}
