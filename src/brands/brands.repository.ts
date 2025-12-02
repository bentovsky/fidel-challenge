import { Injectable, BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { Brand } from "../dynamodb/entities";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

@Injectable()
export class BrandsRepository {
  constructor(private readonly dynamoDBService: DynamoDBService) {}

  private decodeCursor(cursor: string): Record<string, unknown> {
    try {
      return JSON.parse(Buffer.from(cursor, "base64").toString());
    } catch {
      throw new BadRequestException("Invalid cursor");
    }
  }

  async findAll(limit: number, cursor?: string): Promise<PaginatedResult<Brand>> {
    const result = await this.dynamoDBService.scan(Tables.BRANDS, {
      Limit: limit,
      ExclusiveStartKey: cursor ? this.decodeCursor(cursor) : undefined,
    });

    return {
      items: plainToInstance(Brand, result.Items || []),
      nextCursor: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
        : undefined,
    };
  }

  async create(brand: Brand): Promise<Brand> {
    await this.dynamoDBService.put(Tables.BRANDS, { Item: brand });
    return plainToInstance(Brand, brand);
  }

  async findById(id: string): Promise<Brand | null> {
    const result = await this.dynamoDBService.get(Tables.BRANDS, {
      Key: { id },
    });
    return result.Item ? plainToInstance(Brand, result.Item) : null;
  }

  async findByNameLower(nameLower: string): Promise<Brand | null> {
    const result = await this.dynamoDBService.query(Tables.BRANDS, {
      IndexName: "nameLower-index",
      KeyConditionExpression: "nameLower = :nameLower",
      ExpressionAttributeValues: { ":nameLower": nameLower },
    });
    return result.Items?.[0] ? plainToInstance(Brand, result.Items[0]) : null;
  }

  async update(brand: Brand): Promise<Brand> {
    await this.dynamoDBService.put(Tables.BRANDS, { Item: brand });
    return plainToInstance(Brand, brand);
  }

  async delete(id: string): Promise<void> {
    await this.dynamoDBService.delete(Tables.BRANDS, {
      Key: { id },
    });
  }
}
