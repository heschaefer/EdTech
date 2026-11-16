import IORedis from 'ioredis';
import { env } from '../../config/env';

export const FILA_EMAILS = 'emails';
export const FILA_PRAZOS = 'prazos';

export const conexaoRedis = () => new IORedis(env().REDIS_URL, { maxRetriesPerRequest: null });
