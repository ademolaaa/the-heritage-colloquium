const base = process.env.BASE_URL || 'http://localhost:8787';
const passcode = process.env.ADMIN_PASSCODE || 'heritage-admin';

async function get(path) {
  const res = await fetch(`${base}${path}`);
  const text = await res.text();
  return { status: res.status, text };
}

async function postJson(path, body, admin = false) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(admin ? { 'x-admin-passcode': passcode } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function run() {
  const health = await get('/api/health');
  console.log('GET /api/health', health.status, health.text);

  const v1 = await get('/api/v1/health');
  console.log('GET /api/v1/health', v1.status, v1.text);

  const list0 = await get('/api/v1/lectures?limit=2');
  console.log('GET /api/v1/lectures', list0.status, list0.text);

  const created = await postJson('/api/v1/lectures', { year: 1981, title: 'Smoke Test Lecture' }, true);
  console.log('POST /api/v1/lectures', created.status, created.text);

  const search = await get('/api/v1/search?q=smoke');
  console.log('GET /api/v1/search?q=smoke', search.status, search.text);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

