const baseUrl = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  if (login.status !== 200 || !login.body?.token) {
    console.error('LOGIN_FAILED', login);
    process.exit(1);
  }

  const token = login.body.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const all = await request('/api/services', { headers });
  console.log('ALL', all.status, Array.isArray(all.body) ? all.body.map((s) => `${s.name}:${s.active}`) : all.body);

  const active = await request('/api/services?active=true', { headers });
  console.log('ACTIVE', active.status, Array.isArray(active.body) ? active.body.map((s) => `${s.name}:${s.active}`) : active.body);

  const inactive = await request('/api/services?active=false', { headers });
  console.log('INACTIVE', inactive.status, Array.isArray(inactive.body) ? inactive.body.map((s) => `${s.name}:${s.active}`) : inactive.body);

  const search = await request('/api/services?q=hair', { headers });
  console.log('SEARCH', search.status, Array.isArray(search.body) ? search.body.map((s) => s.name) : search.body);

  const created = await request('/api/services', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Test Service',
      price: 1500,
      duration: 45,
      description: 'Temporary service',
    }),
  });
  console.log('CREATE', created.status, created.body?.price);

  const updated = await request('/api/services', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      id: created.body.id,
      price: 2000,
      active: false,
      name: 'Test Service Updated',
    }),
  });
  console.log('UPDATE', updated.status, updated.body?.price, updated.body?.active, updated.body?.name);

  const deleted = await request('/api/services', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ id: created.body.id }),
  });
  console.log('DELETE', deleted.status, deleted.body?.success);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
