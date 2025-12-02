import { Injectable, BadRequestException } from "@nestjs/common";
import { DynamoDBService, Tables } from "../dynamodb/dynamodb.service";
import { Offer } from "../dynamodb/entities";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

@Injectable()
export class OffersRepository {
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
  ): Promise<PaginatedResult<Offer>> {
    if (brandId) {
      const result = await this.dynamoDBService.query(Tables.OFFERS, {
        IndexName: "brandId-index",
        KeyConditionExpression: "brandId = :brandId",
        ExpressionAttributeValues: { ":brandId": brandId },
        Limit: limit,
        ExclusiveStartKey: cursor ? this.decodeCursor(cursor) : undefined,
      });

      return {
        items: (result.Items as Offer[]) || [],
        nextCursor: result.LastEvaluatedKey
          ? this.encodeCursor(result.LastEvaluatedKey)
          : undefined,
      };
    }

    const result = await this.dynamoDBService.scan(Tables.OFFERS, {
      Limit: limit,
      ExclusiveStartKey: cursor ? this.decodeCursor(cursor) : undefined,
    });

    return {
      items: (result.Items as Offer[]) || [],
      nextCursor: result.LastEvaluatedKey
        ? this.encodeCursor(result.LastEvaluatedKey)
        : undefined,
    };
  }

  async create(offer: Offer): Promise<Offer> {
    await this.dynamoDBService.put(Tables.OFFERS, { Item: offer });
    return offer;
  }

  async findById(id: string): Promise<Offer | null> {
    const result = await this.dynamoDBService.get(Tables.OFFERS, {
      Key: { id },
    });
    return (result.Item as Offer) || null;
  }

  async findByBrandIdAndName(
    brandId: string,
    name: string
  ): Promise<Offer | null> {
    const result = await this.dynamoDBService.query(Tables.OFFERS, {
      IndexName: "brandId-name-index",
      KeyConditionExpression: "brandId = :brandId AND #name = :name",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":brandId": brandId, ":name": name },
    });
    return (result.Items?.[0] as Offer) || null;
  }

  async update(offer: Offer): Promise<Offer> {
    await this.dynamoDBService.put(Tables.OFFERS, { Item: offer });
    return offer;
  }

  async incrementLocationsTotal(id: string): Promise<void> {
    await this.dynamoDBService.update(Tables.OFFERS, {
      Key: { id },
      UpdateExpression: "SET locationsTotal = locationsTotal + :inc, updatedAt = :now",
      ExpressionAttributeValues: {
        ":inc": 1,
        ":now": new Date().toISOString(),
      },
    });
  }

  async decrementLocationsTotal(id: string): Promise<void> {
    await this.dynamoDBService.update(Tables.OFFERS, {
      Key: { id },
      UpdateExpression: "SET locationsTotal = locationsTotal - :dec, updatedAt = :now",
      ConditionExpression: "locationsTotal > :zero",
      ExpressionAttributeValues: {
        ":dec": 1,
        ":zero": 0,
        ":now": new Date().toISOString(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.dynamoDBService.delete(Tables.OFFERS, {
      Key: { id },
    });
  }
}
