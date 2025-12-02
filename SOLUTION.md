# Solution Documentation

## Overview

This is a serverless Offers API platform built with NestJS, AWS Lambda, and DynamoDB. The API allows customers to connect brands to offers and link offers to specific locations (e.g., "Add 5% cashback offer to Starbucks Oxford Street location").

## Architecture

### Technology Stack

| Component  | Technology                                  |
| ---------- | ------------------------------------------- |
| Framework  | NestJS                                      |
| Runtime    | AWS Lambda (via @vendia/serverless-express) |
| Database   | Amazon DynamoDB                             |
| Deployment | Serverless Framework                        |
| Language   | TypeScript                                  |

### Architecture Diagram

```
+---------------------------------------------------------------+
|                        API Gateway                            |
|                    (HTTP API - httpApi)                       |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|                        AWS Lambda                             |
|  +----------------------------------------------------------+ |
|  |                   NestJS Application                     | |
|  |                                                          | |
|  |  +-------------+  +-------------+  +-------------+       | |
|  |  |   Brands    |  |  Locations  |  |   Offers    |       | |
|  |  |  Controller |  |  Controller |  |  Controller |       | |
|  |  +------+------+  +------+------+  +------+------+       | |
|  |         |                |                |              | |
|  |         v                v                v              | |
|  |  +-------------+  +-------------+  +-------------+       | |
|  |  |   Brands    |  |  Locations  |  |   Offers    |       | |
|  |  |   Service   |  |   Service   |  |   Service   |       | |
|  |  +------+------+  +------+------+  +------+------+       | |
|  |         |                |                |              | |
|  |         v                v                v              | |
|  |  +-------------+  +-------------+  +-------------+       | |
|  |  |   Brands    |  |  Locations  |  |   Offers    |       | |
|  |  | Repository  |  | Repository  |  | Repository  |       | |
|  |  +------+------+  +------+------+  +------+------+       | |
|  |         |                |                |              | |
|  |         +----------------+----------------+              | |
|  |                          |                               | |
|  |                          v                               | |
|  |                  +---------------+                       | |
|  |                  |   DynamoDB    |                       | |
|  |                  |    Service    |                       | |
|  |                  +---------------+                       | |
|  +----------------------------------------------------------+ |
+-------------------------------+-------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|                         DynamoDB                              |
|                                                               |
|    +-------------+   +-------------+   +-------------+        |
|    |   brands    |   |  locations  |   |   offers    |        |
|    |    table    |   |    table    |   |    table    |        |
|    +-------------+   +-------------+   +-------------+        |
+---------------------------------------------------------------+
```

## API Endpoints

### Brands

| Method | Endpoint      | Description                 |
| ------ | ------------- | --------------------------- |
| GET    | `/brands`     | List all brands (paginated) |
| GET    | `/brands/:id` | Get a brand by ID           |
| POST   | `/brands`     | Create a new brand          |
| PUT    | `/brands/:id` | Update a brand              |
| DELETE | `/brands/:id` | Delete a brand              |

### Locations

| Method | Endpoint         | Description                                        |
| ------ | ---------------- | -------------------------------------------------- |
| GET    | `/locations`     | List locations (paginated, **brandId required**)   |
| GET    | `/locations/:id` | Get a location by ID                               |
| POST   | `/locations`     | Create a new location                              |
| PUT    | `/locations/:id` | Update a location                                  |
| DELETE | `/locations/:id` | Delete a location                                  |

### Offers

| Method   | Endpoint                                | Description                                     |
| -------- | --------------------------------------- | ----------------------------------------------- |
| GET      | `/offers`                               | List offers (paginated, **brandId required**)   |
| GET      | `/offers/:id`                           | Get an offer by ID                              |
| POST     | `/offers`                               | Create a new offer                                 |
| PUT      | `/offers/:id`                           | Update an offer                                    |
| DELETE   | `/offers/:id`                           | Delete an offer                                    |
| **POST** | **`/offers/:id/locations/:locationId`** | **Link a location to an offer**                    |
| DELETE   | `/offers/:id/locations/:locationId`     | Unlink a location from an offer                    |

## Core Feature: Linking Locations to Offers

The primary feature is the `POST /offers/:offerId/locations/:locationId` endpoint which atomically:

1. **Increments the offer's `locationsTotal` counter**
2. **Sets the location's `hasOffer` flag to `true`**

### Implementation Details

The linking operation uses a **DynamoDB Transaction** to ensure atomic updates across both tables:

```typescript
await this.dynamoDBService.transactWrite({
  TransactItems: [
    {
      Update: {
        TableName: "locations",
        Key: { id: locationId },
        UpdateExpression:
          "ADD offerIds :offerId SET hasOffer = :hasOffer, updatedAt = :now",
        // Prevent race condition: check at write time, not read time
        ConditionExpression:
          "attribute_not_exists(offerIds) OR NOT contains(offerIds, :offerIdValue)",
        ExpressionAttributeValues: {
          ":offerId": new Set([offerId]),
          ":offerIdValue": offerId,
          ":hasOffer": true,
          ":now": now,
        },
      },
    },
    {
      Update: {
        TableName: "offers",
        Key: { id: offerId },
        UpdateExpression:
          "ADD locationIds :locationId SET locationsTotal = locationsTotal + :inc, updatedAt = :now",
        // Prevent race condition: check at write time, not read time
        ConditionExpression:
          "attribute_not_exists(locationIds) OR NOT contains(locationIds, :locationIdValue)",
        ExpressionAttributeValues: {
          ":locationId": new Set([locationId]),
          ":locationIdValue": locationId,
          ":inc": 1,
          ":now": now,
        },
      },
    },
  ],
});
```

### Validation Rules

Before linking, the service validates:

- The offer exists
- The location exists
- The location belongs to the same brand as the offer
- The offer is not already linked to this location

## DynamoDB Data Model

### Brands Table

| Attribute     | Type   | Description                                    |
| ------------- | ------ | ---------------------------------------------- |
| `id` (PK)     | String | UUID                                           |
| `name`        | String | Brand name                                     |
| `nameLower`   | String | Lowercase name for case-insensitive uniqueness |
| `description` | String | Brand description                              |
| `createdAt`   | String | ISO 8601 timestamp                             |
| `updatedAt`   | String | ISO 8601 timestamp                             |

**GSI:** `nameLower-index` (for uniqueness checks)

### Locations Table

| Attribute   | Type          | Description                                      |
| ----------- | ------------- | ------------------------------------------------ |
| `id` (PK)   | String        | UUID                                             |
| `brandId`   | String        | Reference to brand                               |
| `name`      | String        | Location name                                    |
| `nameLower` | String        | Lowercase name for case-insensitive uniqueness   |
| `address`   | String        | Physical address                                 |
| `offerIds`  | Set\<String\> | Set of linked offer IDs                          |
| `hasOffer`  | Boolean       | Quick flag indicating if location has any offers |
| `createdAt` | String        | ISO 8601 timestamp                               |
| `updatedAt` | String        | ISO 8601 timestamp                               |

**GSIs:**

- `brandId-name-index` (for filtering by brand)
- `brandId-nameLower-index` (for case-insensitive uniqueness checks)

### Offers Table

| Attribute        | Type          | Description                 |
| ---------------- | ------------- | --------------------------- |
| `id` (PK)        | String        | UUID                        |
| `brandId`        | String        | Reference to brand          |
| `name`           | String        | Offer name                  |
| `description`    | String        | Offer description           |
| `locationIds`    | Set\<String\> | Set of linked location IDs  |
| `locationsTotal` | Number        | Counter of linked locations |
| `createdAt`      | String        | ISO 8601 timestamp          |
| `updatedAt`      | String        | ISO 8601 timestamp          |

**GSIs:**

- `brandId-index` (for filtering by brand)
- `brandId-name-index` (for uniqueness checks)

## Concurrency Handling

### Atomic Counter Updates

The `locationsTotal` counter uses DynamoDB's atomic counter operations:

- `SET locationsTotal = locationsTotal + :inc` for increments
- `SET locationsTotal = locationsTotal - :dec` with `ConditionExpression: "locationsTotal > :zero"` for decrements

### Transactional Writes

The link/unlink operations use `TransactWriteItems` to ensure:

- Both tables are updated atomically
- If one update fails, the entire transaction is rolled back
- No partial states can occur

### Race Condition Prevention

The link/unlink operations use `ConditionExpression` to prevent race conditions:

**Problem:** Two concurrent requests to link the same offer to the same location could both pass the pre-transaction validation check, resulting in the counter being incremented twice while the Set only contains one entry.

**Solution:** Check existence at write time using `ConditionExpression`:

```typescript
// For linking - fail if already linked
ConditionExpression: "attribute_not_exists(locationIds) OR NOT contains(locationIds, :locationIdValue)"

// For unlinking - fail if not linked
ConditionExpression: "contains(locationIds, :locationIdValue)"
```

This ensures the check and update happen atomically, preventing counter drift from concurrent operations.

## Design Decisions

### 1. Separate Tables vs Single-Table Design

**Decision:** Used separate tables for brands, locations, and offers.

**Rationale:**

- Simpler to understand and maintain
- Each entity has distinct access patterns
- Easier to manage GSIs per entity
- Single-table design complexity wasn't warranted for this use case

### 2. Denormalized `hasOffer` Flag

**Decision:** Store a `hasOffer` boolean on locations instead of querying offerIds.

**Rationale:**

- Enables efficient filtering of locations with/without offers
- Avoids expensive scans to determine if a location has offers
- Small storage overhead for significant query performance gain

### 3. `locationsTotal` Counter

**Decision:** Maintain a counter rather than computing from `locationIds.size()`.

**Rationale:**

- DynamoDB Sets are returned fully on read (no size operation)
- Counter updates are atomic and efficient
- Avoids read-before-write patterns

### 4. Cursor-Based Pagination

**Decision:** Use base64-encoded `LastEvaluatedKey` as cursor.

**Rationale:**

- Native to DynamoDB pagination model
- Stateless - no server-side session needed
- Opaque to clients, can change encoding if needed

### 5. Brand Ownership Validation

**Decision:** Offers can only be linked to locations of the same brand.

**Rationale:**

- Maintains data integrity
- Prevents cross-brand offer assignments
- Clear business rule enforcement

## Assumptions

1. **UUIDs for IDs:** All entity IDs are UUIDs generated server-side
2. **Brand Required First:** Brands must exist before creating locations or offers
3. **No Cascading Deletes:** Deleting a brand doesn't automatically delete its locations/offers
4. **Single Region:** DynamoDB tables are in a single AWS region
5. **Authenticated Requests:** Authentication/authorization is handled externally (e.g., API Gateway authorizers)

## Local Development

### Prerequisites

- Node.js 20+
- Docker (for local DynamoDB)
- AWS CLI (optional, for deployment)

### Setup

```bash
# Install dependencies
npm install

# Start local DynamoDB
docker-compose up -d

# Create tables
npm run db:create

# Run in development mode
npm run start:dev
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
AWS_REGION="eu-west-1"
NODE_ENV="development"
PORT="3000"
DYNAMODB_ENDPOINT="http://localhost:8000"
```

## Deployment

### Deploy to AWS

```bash
# Build and deploy
npm run deploy

# Deploy to specific stage
npm run build && serverless deploy --stage production
```

### Deployment Output

After deployment, the Serverless Framework will output the API Gateway URL:

```
endpoints:
  ANY - https://xxxxxxxxxx.execute-api.eu-west-1.amazonaws.com/{proxy+}
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### Run Specific Test File

```bash
npm test -- --testPathPattern=offers
```

## API Usage Examples

### Create a Brand

```bash
curl -X POST http://localhost:3000/brands \
  -H "Content-Type: application/json" \
  -d '{"name": "Starbucks", "description": "Coffee company"}'
```

### Create a Location

```bash
curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -d '{"brandId": "<brand-id>", "name": "Oxford Street", "address": "123 Oxford St, London"}'
```

### Create an Offer

```bash
curl -X POST http://localhost:3000/offers \
  -H "Content-Type: application/json" \
  -d '{"brandId": "<brand-id>", "name": "Summer Sale", "description": "10% cashback"}'
```

### Link Location to Offer

```bash
curl -X POST http://localhost:3000/offers/<offer-id>/locations/<location-id>
```

### Response Example

```json
{
  "id": "offer-uuid",
  "brandId": "brand-uuid",
  "name": "Summer Sale",
  "description": "10% cashback",
  "locationIds": ["location-uuid"],
  "locationsTotal": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

## Project Structure

```
src/
├── main.ts                    # NestJS bootstrap (local dev)
├── lambda.ts                  # Lambda handler entry point
├── app.module.ts              # Root module
├── common/
│   └── utils.ts               # Utility functions (generateId, timestamp, hasItem)
├── dynamodb/
│   ├── dynamodb.module.ts     # DynamoDB module
│   ├── dynamodb.service.ts    # DynamoDB client wrapper
│   └── entities/              # Entity classes
├── brands/
│   ├── brands.module.ts
│   ├── brands.controller.ts
│   ├── brands.service.ts
│   ├── brands.repository.ts
│   └── dto/
├── locations/
│   ├── locations.module.ts
│   ├── locations.controller.ts
│   ├── locations.service.ts
│   ├── locations.repository.ts
│   └── dto/
└── offers/
    ├── offers.module.ts
    ├── offers.controller.ts
    ├── offers.service.ts
    ├── offers.repository.ts
    └── dto/
```
