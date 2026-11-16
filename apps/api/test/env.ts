import { readFileSync } from 'node:fs';
import { join } from 'node:path';

Object.assign(process.env, JSON.parse(readFileSync(join(__dirname, '.env.int.json'), 'utf8')));
