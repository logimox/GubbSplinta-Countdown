import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const workerOrigin = 'https://gubbsplinta-discord-proxy.gubbsplinta.workers.dev';
const players = [
  ['Kakan', '322841126476447744'],
  ['LogiMOX', '151053160847376384'],
  ['Bjestavs', '877991544941076542'],
  ['Doxos', '284415770291732490']
];

for (const [name, id] of players) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  execFileSync('npx', ['wrangler', 'kv', 'key', 'put', '--remote', '--binding', 'GUBBSPLINTA_STATE', `magic:${hash}`, id], { stdio: 'inherit' });
  console.log(`${name}: ${workerOrigin}/auth/magic?token=${token}`);
}

console.log('\nSkicka varje länk privat till rätt person. Kör skriptet igen för att ersätta länkarna; radera gamla magic:<hash>-nycklar i KV om de ska återkallas helt.');
