import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe, ClassSerializerInterceptor } from "@nestjs/common";
import { Callback, Context, Handler } from "aws-lambda";
import serverlessExpress from "@vendia/serverless-express";
import { AppModule } from "./app.module";

/** Cached server instance for Lambda warm starts */
let server: Handler;

/**
 * Bootstraps the NestJS application for Lambda execution.
 * Configures global validation pipes and serialization interceptors.
 * @returns Promise resolving to a serverless-express handler
 */
async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressApp });
}

/**
 * AWS Lambda handler for the Offers API.
 * Reuses the NestJS application instance across invocations for performance.
 * @param event - API Gateway event
 * @param context - Lambda execution context
 * @param callback - Lambda callback function
 * @returns Promise resolving to API Gateway response
 */
export const handler: Handler = async (
  event: unknown,
  context: Context,
  callback: Callback
) => {
  server = server ?? (await bootstrap());
  return server(event, context, callback);
};
