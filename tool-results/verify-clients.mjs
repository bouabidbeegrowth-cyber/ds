const baseUrl = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
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

  const search = await request('/api/clients?q=Jo', { headers });
  console.log('SEARCH', search.status, Array.isArray(search.body) ? search.body.map((c) => `${c.firstName} ${c.lastName}`) : search.body);

  const created = await request('/api/clients', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: 'Temp',
      lastName: 'Client',
      phone: '123456789',
      email: 'temp@example.com',
      address: 'Test address',
      remarks: 'Temp record',
    }),
  });
  console.log('CREATE', created.status, created.body?.id);

  const updated = await request('/api/clients', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      id: created.body.id,
      firstName: 'Temp2',
      remarks: 'Updated record',
    }),
  });
  console.log('UPDATE', updated.status, updated.body?.firstName, updated.body?.remarks);

  const deleted = await request('/api/clients', {
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
