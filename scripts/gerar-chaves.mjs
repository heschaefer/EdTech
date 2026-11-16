#!/usr/bin/env node
// Gera .env a partir de .env.example com par RSA (JWT RS256) e chaves de 32 bytes (AES-GCM e HMAC).
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const destino = process.argv[2] ?? '.env';
if (existsSync(destino) && !process.argv.includes('--forcar')) {
  console.error(`${destino} já existe. Use --forcar para sobrescrever.`);
  process.exit(1);
}
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const umaLinha = (pem) => `"${pem.trim().replace(/\n/g, '\\n')}"`;
const valores = {
  JWT_PRIVATE_KEY: umaLinha(privateKey),
  JWT_PUBLIC_KEY: umaLinha(publicKey),
  DADOS_ENC_KEY: randomBytes(32).toString('base64'),
  CPF_HMAC_KEY: randomBytes(32).toString('base64'),
};
const texto = readFileSync('.env.example', 'utf8').replace(/^(\w+)=$/gm, (linha, nome) => (nome in valores ? `${nome}=${valores[nome]}` : linha));
writeFileSync(destino, texto);
console.log(`${destino} gerado.`);
