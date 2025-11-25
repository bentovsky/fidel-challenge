# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a serverless Offers API platform that allows customers to connect brands to offers (e.g., "Add 5% cashback offer to Starbucks Oxford street location").

**Tech Stack:**
- NestJS (framework)
- AWS Lambda (runtime via @vendia/serverless-express)
- DynamoDB (database)
- Serverless Framework (deployment)
- TypeScript

## Build & Deploy Commands

```bash
# Install dependencies
npm install

# Run locally (NestJS dev server)
npm run start:dev

# Run locally with serverless-offline
npm run offline
# or: serverless offline

# Build for production
npm run build

# Deploy to AWS
serverless deploy

# Deploy single function
serverless deploy function -f main

# Run tests
npm test

# Run single test file
npm test -- <path/to/test.spec.ts>

# Run e2e tests
npm run test:e2e

# Lint
npm run lint
```

## Project Structure

```
src/
├── main.ts                 # NestJS bootstrap (local dev)
├── lambda.ts               # Lambda handler entry point
├── app.module.ts           # Root module
├── offers/
│   ├── offers.module.ts
│   ├── offers.controller.ts
│   ├── offers.service.ts
│   └── dto/
├── locations/
│   ├── locations.module.ts
│   ├── locations.controller.ts
│   ├── locations.service.ts
│   └── dto/
└── dynamodb/
    ├── dynamodb.module.ts
    └── dynamodb.service.ts
```

## NestJS Conventions

- Use dependency injection for services
- DTOs with class-validator for request validation
- Separate `lambda.ts` entry point that wraps NestJS app with serverless-express
- Use `@nestjs/config` for environment configuration

## Architecture

### DynamoDB Data Model

Uses single-table design with composite keys to support multiple access patterns:

**Primary Table:** `OffersTable`
- **PK (Partition Key):** Entity identifier (e.g., `OFFER#<id>`, `LOCATION#<id>`)
- **SK (Sort Key):** Relationship or metadata (e.g., `METADATA`, `LOCATION#<id>`)
- **GSI1:** For reverse lookups (e.g., get all locations for an offer)

**Access Patterns:**
1. Get offer by ID: `PK = OFFER#<id>, SK = METADATA`
2. Get location by ID: `PK = LOCATION#<id>, SK = METADATA`
3. Get all locations linked to an offer: Query GSI1 where `GSI1PK = OFFER#<id>`
4. Get all offers for a location: Query where `PK = LOCATION#<id>, SK begins_with OFFER#`

### API Endpoints

- `POST /offers/{offerId}/locations/{locationId}` - Link location to offer
  - Increments offer's `locationsTotal` counter
  - Sets location's `hasOffer` to true
  - Creates offer-location relationship record

### Concurrency Handling

- Use DynamoDB conditional writes and atomic counters for `locationsTotal`
- Implement optimistic locking where needed
- Consider DynamoDB transactions for multi-item updates

## Key Design Decisions

- **Single-table design:** Reduces read costs and simplifies queries
- **Denormalized `hasOffer` flag:** Avoids joins when listing locations
- **Atomic counter updates:** Ensures accurate `locationsTotal` under concurrent writes
- **GSI for reverse lookups:** Efficiently query locations by offer without scanning
