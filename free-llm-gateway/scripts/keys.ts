/**
 * Configure provider credentials once per machine, for every project at once.
 *
 *   npm run keys                    # what is configured, and where it came from
 *   npm run keys:set groq gsk_...   # store a key in ~/.free-llm/keys.env
 *   npm run keys:rm groq            # forget it
 *
 * The alternative this replaces is per-repository secrets: with 28 repos and
 * 9 providers that is 252 places to paste a credential and 252 places to
 * update when one rotates. Here it is one file, read by every install.
 */
import fs from 'node:fs';
import {
  PROVIDER_API_KEY_ENV,
  PROVIDER_SIGNUP_URL,
  getApiKey,
  apiKeySource,
} from '../src/providers/apiKeys';
import { globalKeysPath, keyFileChain, parseEnvFile, writeGlobalKey, resetKeyStore } from '../src/providers/keyStore';

/** Never print a credential in full: this output gets pasted into chats. */
function mask(key: string): string {
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function list() {
  console.log(`\nFichier machine : ${globalKeysPath()}`);
  console.log('Ordre de lecture : environnement > ./.env > fichier machine\n');

  const ids = Object.keys(PROVIDER_API_KEY_ENV).sort();
  let configured = 0;

  for (const id of ids) {
    const key = getApiKey(id);
    const envVar = PROVIDER_API_KEY_ENV[id];

    if (key) {
      configured++;
      const src = apiKeySource(id);
      const where = src === 'environment' ? 'environnement' : src === globalKeysPath() ? 'machine' : (src ?? '?');
      console.log(`  ✅ ${pad(id, 12)} ${pad(mask(key), 16)} ${where}`);
    } else {
      console.log(`  ·  ${pad(id, 12)} ${pad('—', 16)} ${PROVIDER_SIGNUP_URL[id] ?? ''}`);
    }
  }

  console.log(`\n${configured}/${ids.length} providers configurés.`);
  if (configured < ids.length) {
    console.log('Ajouter :  npm run keys:set <provider> <clé>\n');
  } else {
    console.log('');
  }
}

function set(providerId: string, key: string) {
  const envVar = PROVIDER_API_KEY_ENV[providerId];
  if (!envVar) {
    console.error(`Provider inconnu : "${providerId}"`);
    console.error(`Connus : ${Object.keys(PROVIDER_API_KEY_ENV).sort().join(', ')}`);
    process.exit(1);
  }
  if (!key?.trim()) {
    console.error(`Clé vide. Usage : npm run keys:set ${providerId} <clé>`);
    process.exit(1);
  }

  const file = writeGlobalKey(envVar, key.trim());
  console.log(`\n✅ ${providerId} → ${envVar}=${mask(key.trim())}`);
  console.log(`   écrit dans ${file} (permissions 0600)\n`);
  console.log('Actif immédiatement pour tous les projets de cette machine.\n');

  // An env var already set in the shell would shadow what we just wrote, and
  // the user would rightly think the command did nothing.
  if (process.env[envVar]?.trim() && process.env[envVar]?.trim() !== key.trim()) {
    console.log(`⚠️  ${envVar} est aussi défini dans ce shell avec une autre valeur,`);
    console.log(`   et l'environnement est prioritaire. Fais \`unset ${envVar}\` pour`);
    console.log('   que le fichier machine prenne le relais.\n');
  }
}

function remove(providerId: string) {
  const envVar = PROVIDER_API_KEY_ENV[providerId];
  if (!envVar) {
    console.error(`Provider inconnu : "${providerId}"`);
    process.exit(1);
  }

  const file = globalKeysPath();
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    console.log(`Rien à supprimer : ${file} n'existe pas.`);
    return;
  }

  const kept = text
    .split(/\r?\n/)
    .filter((l) => !l.trim().replace(/^export\s+/, '').startsWith(`${envVar}=`));

  fs.writeFileSync(file, kept.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
  resetKeyStore();
  console.log(`\n🗑️  ${envVar} retiré de ${file}\n`);
}

function doctor() {
  console.log('\nFichiers consultés (le premier trouvé gagne) :\n');
  for (const file of keyFileChain()) {
    try {
      const stat = fs.statSync(file);
      const vars = Object.keys(parseEnvFile(fs.readFileSync(file, 'utf8')));
      const mode = (stat.mode & 0o777).toString(8).padStart(3, '0');
      console.log(`  ✅ ${file}`);
      console.log(`     ${vars.length} variables, permissions ${mode}`);
      if (file === globalKeysPath() && (stat.mode & 0o077) !== 0) {
        console.log('     ⚠️  lisible par d\'autres comptes — `chmod 600` recommandé');
      }
    } catch {
      console.log(`  ·  ${file} (absent)`);
    }
  }
  console.log('');
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case undefined:
  case 'list':
    list();
    break;
  case 'set':
    set(rest[0], rest.slice(1).join(' '));
    break;
  case 'rm':
  case 'remove':
    remove(rest[0]);
    break;
  case 'doctor':
    doctor();
    break;
  default:
    console.error(`Commande inconnue : "${command}"`);
    console.error('Usage : keys [list] | set <provider> <clé> | rm <provider> | doctor');
    process.exit(1);
}
