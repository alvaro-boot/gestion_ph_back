import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const fromEnv = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [];
  if (fromEnv.includes(origin)) return true;
  // En desarrollo: cualquier puerto local (3000, 3002, etc.)
  if (process.env.NODE_ENV !== 'production') {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqueado para: ${origin}`));
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API en http://localhost:${port}/api`);
}
bootstrap();
