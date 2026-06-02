import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as entities from '../entities';

export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.get<number>('DB_PORT', 3306),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_DATABASE'),
    entities: Object.values(entities),
    synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
    charset: 'utf8mb4',
    timezone: 'Z',
    connectTimeout: 30000,
  };
}
