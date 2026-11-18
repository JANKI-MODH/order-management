import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { config } from "dotenv";
import { resolve } from "node:path";
import { AppModule } from "./app.module";

config({ path: resolve(process.cwd(), "../.env") });

async function bootstrap(): Promise<void> {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32 || secret === "change-me-to-a-long-random-string") {
    throw new Error("Set a private JWT_SECRET of at least 32 characters in .env");
  }

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`listening on http://localhost:${port}`);
}

void bootstrap();
