import { Injectable, BadRequestException } from "@nestjs/common";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { Location } from "../dynamodb/entities";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

@Injectable()
export class LocationsRepository {
  constructor(private readonly dynamoDBService: DynamoDBService) {}

  private decodeCursor(cursor: string): Record<string, unknown> {
    try {
      return JSON.parse(Buffer.from(cursor, "base64").toString());
    } catch {
      throw new BadRequestException("Invalid cursor");
    }
  }

  private encodeCursor(key: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(key)).toString("base64");
  }

  async findAll(
    limit: number,
    cursor?: string,
    brandId?: string
  ): Promise<PaginatedResult<Location>> {
    if (brandId) {
      const result = await this.dynamoDBService.query(Tables.LOCATIONS, {
        IndexName: "brandId-name-index",
        KeyConditionExpression: "brandId = :brandId",
        ExpressionAttributeValues: { ":brandId": brandId },
        Limit: limit,
        ExclusiveStartKey: cursor ? this.decodeCursor(cursor) : undefined,
      });

      return {
        items: (result.Items as Location[]) || [],
        nextCursor: result.LastEvaluatedKey
          ? this.encodeCursor(result.LastEvaluatedKey)
          : undefined,
      };
    }

    const result = await this.dynamoDBService.scan(Tables.LOCATIONS, {
      Limit: limit,
      ExclusiveStartKey: cursor ? this.decodeCursor(cursor) : undefined,
    });

    return {
      items: (result.Items as Location[]) || [],
      nextCursor: result.LastEvaluatedKey
        ? this.encodeCursor(result.LastEvaluatedKey)
        : undefined,
    };
  }

  async create(location: Location): Promise<Location> {
    await this.dynamoDBService.put(Tables.LOCATIONS, { Item: location });
    return location;
  }

  async findById(id: string): Promise<Location | null> {
    const result = await this.dynamoDBService.get(Tables.LOCATIONS, {
      Key: { id },
    });
    return (result.Item as Location) || null;
  }

  async findByBrandIdAndName(
    brandId: string,
    name: string
  ): Promise<Location | null> {
    const result = await this.dynamoDBService.query(Tables.LOCATIONS, {
      IndexName: "brandId-name-index",
      KeyConditionExpression: "brandId = :brandId AND #name = :name",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":brandId": brandId, ":name": name },
    });
    return (result.Items?.[0] as Location) || null;
  }

  async update(location: Location): Promise<Location> {
    await this.dynamoDBService.put(Tables.LOCATIONS, { Item: location });
    return location;
  }

  async delete(id: string): Promise<void> {
    await this.dynamoDBService.delete(Tables.LOCATIONS, {
      Key: { id },
    });
  }
}
