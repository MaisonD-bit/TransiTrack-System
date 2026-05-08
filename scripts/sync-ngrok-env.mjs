import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const WORKSPACE = process.cwd();
const NGROK_API = process.env.NGROK_API || 'http://127.0.0.1:4040/api/tunnels';

function withApiSuffix(publicUrl, suffix) {
  const base = String(publicUrl || '').replace(/\/+$/, '');
  const suf = String(suffix || '').replace(/^\/+/, '');
  return `${base}/${suf}`;
}

async function getNgrokPublicUrl({ port = 8000 } = {}) {
  const res = await fetch(NGROK_API, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to read ngrok api (${res.status})`);
  const data = await res.json();
  const tunnels = Array.isArray(data?.tunnels) ? data.tunnels : [];

  // Prefer HTTPS tunnel for the desired port.
  const match = tunnels.find((t) => {
    const pub = String(t?.public_url || '');
    const addr = String(t?.config?.addr || '');
    return pub.startsWith('https://') && addr.includes(String(port));
  }) || tunnels.find((t) => String(t?.public_url || '').startsWith('https://'));

  const publicUrl = match?.public_url;
  if (!publicUrl) throw new Error('No ngrok tunnel public_url found. Is ngrok running?');
  return publicUrl;
}

async function replaceApiUrlInFile(filePath, newApiUrl) {
  const before = await fs.readFile(filePath, 'utf8');
  const next = before.replace(
    /apiUrl\s*:\s*(['"`])([^'"`]*?)\1/,
    (m, q) => `apiUrl: ${q}${newApiUrl}${q}`
  );
  if (next === before) {
    throw new Error(`Could not find apiUrl in ${filePath}`);
  }
  await fs.writeFile(filePath, next, 'utf8');
}

async function main() {
  // ngrok may take a moment to populate tunnels; retry a bit.
  let publicUrl = null;
  let lastErr = null;
  for (let i = 0; i < 20; i++) {
    try {
      publicUrl = await getNgrokPublicUrl({ port: 8000 });
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!publicUrl) throw lastErr || new Error('No ngrok tunnel public_url found. Is ngrok running?');

  const driverApi = withApiSuffix(publicUrl, 'api');
  const commuterApi = withApiSuffix(publicUrl, 'api/v1');

  const files = [
    {
      file: path.join(WORKSPACE, 'TansTrack', 'transit', 'src', 'environments', 'environment.ts'),
      api: driverApi,
    },
    {
      file: path.join(WORKSPACE, 'TansTrack', 'transit', 'src', 'environments', 'environment.prod.ts'),
      api: driverApi,
    },
    {
      file: path.join(WORKSPACE, 'TansTrack', 'Commuters', 'src', 'environments', 'environment.ts'),
      api: commuterApi,
    },
    {
      file: path.join(WORKSPACE, 'TansTrack', 'Commuters', 'src', 'environments', 'environment.prod.ts'),
      api: commuterApi,
    },
  ];

  for (const f of files) {
    await replaceApiUrlInFile(f.file, f.api);
  }

  process.stdout.write(
    [
      `ngrok: ${publicUrl}`,
      `driver apiUrl: ${driverApi}`,
      `commuter apiUrl: ${commuterApi}`,
      'updated 4 environment files.',
      '',
    ].join('\n')
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

