import {
  DynamoDBClient,
  CreateTableCommand,
  CreateTableCommandInput,
  DeleteTableCommand,
  ListTablesCommand,
  KeyType,
  ScalarAttributeType,
  BillingMode,
  ProjectionType,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: "local",
  endpoint: "http://localhost:8000",
});

const tables: CreateTableCommandInput[] = [
  {
    TableName: "brands",
    KeySchema: [{ AttributeName: "id", KeyType: KeyType.HASH }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: ScalarAttributeType.S },
      { AttributeName: "nameLower", AttributeType: ScalarAttributeType.S },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "nameLower-index",
        KeySchema: [{ AttributeName: "nameLower", KeyType: KeyType.HASH }],
        Projection: { ProjectionType: ProjectionType.ALL },
      },
    ],
    BillingMode: BillingMode.PAY_PER_REQUEST,
  },
  {
    TableName: "offers",
    KeySchema: [{ AttributeName: "id", KeyType: KeyType.HASH }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: ScalarAttributeType.S },
      { AttributeName: "brandId", AttributeType: ScalarAttributeType.S },
      { AttributeName: "name", AttributeType: ScalarAttributeType.S },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "brandId-index",
        KeySchema: [{ AttributeName: "brandId", KeyType: KeyType.HASH }],
        Projection: { ProjectionType: ProjectionType.ALL },
      },
      {
        IndexName: "brandId-name-index",
        KeySchema: [
          { AttributeName: "brandId", KeyType: KeyType.HASH },
          { AttributeName: "name", KeyType: KeyType.RANGE },
        ],
        Projection: { ProjectionType: ProjectionType.ALL },
      },
    ],
    BillingMode: BillingMode.PAY_PER_REQUEST,
  },
  {
    TableName: "locations",
    KeySchema: [{ AttributeName: "id", KeyType: KeyType.HASH }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: ScalarAttributeType.S },
      { AttributeName: "brandId", AttributeType: ScalarAttributeType.S },
      { AttributeName: "name", AttributeType: ScalarAttributeType.S },
      { AttributeName: "nameLower", AttributeType: ScalarAttributeType.S },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "brandId-name-index",
        KeySchema: [
          { AttributeName: "brandId", KeyType: KeyType.HASH },
          { AttributeName: "name", KeyType: KeyType.RANGE },
        ],
        Projection: { ProjectionType: ProjectionType.ALL },
      },
      {
        IndexName: "brandId-nameLower-index",
        KeySchema: [
          { AttributeName: "brandId", KeyType: KeyType.HASH },
          { AttributeName: "nameLower", KeyType: KeyType.RANGE },
        ],
        Projection: { ProjectionType: ProjectionType.ALL },
      },
    ],
    BillingMode: BillingMode.PAY_PER_REQUEST,
  },
];

const forceRecreate = process.argv.includes("--force");

async function createTables() {
  const { TableNames: existingTables } = await client.send(
    new ListTablesCommand({})
  );

  for (const table of tables) {
    const tableName = table.TableName!;

    if (existingTables?.includes(tableName)) {
      if (forceRecreate) {
        await client.send(new DeleteTableCommand({ TableName: tableName }));
        console.log(`Deleted table "${tableName}"`);
      } else {
        console.log(`Table "${tableName}" already exists, skipping... (use --force to recreate)`);
        continue;
      }
    }

    await client.send(new CreateTableCommand(table));
    console.log(`Created table "${tableName}"`);
  }

  console.log("Done!");
}

createTables().catch(console.error);
