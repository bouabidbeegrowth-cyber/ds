import crypto from 'crypto';

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

let authToken = null;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  if (!res.ok) {
    console.error('Login failed:', await res.text());
    process.exit(1);
  }
  const data = await res.json();
  authToken = data.token;
  console.log('✓ Logged in as admin');
}

async function getAllRoles() {
  const res = await fetch(`${BASE_URL}/roles`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`GET /api/roles failed: ${res.status}`);
  return res.json();
}

async function searchRoles(query) {
  const res = await fetch(`${BASE_URL}/roles?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`GET /api/roles?q= failed: ${res.status}`);
  return res.json();
}

async function createRole(name, permissions) {
  const res = await fetch(`${BASE_URL}/roles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ name, permissions }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`POST /api/roles failed: ${err.error}`);
  }
  return res.json();
}

async function updateRole(id, name, permissions) {
  const res = await fetch(`${BASE_URL}/roles`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ id, name, permissions }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`PUT /api/roles failed: ${err.error}`);
  }
  return res.json();
}

async function deleteRole(id) {
  const res = await fetch(`${BASE_URL}/roles`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`DELETE /api/roles failed: ${err.error}`);
  }
  return res.json();
}

async function main() {
  try {
    await login();

    console.log('\n=== Testing Roles CRUD ===\n');

    // GET all roles
    console.log('GET all roles...');
    const allRoles = await getAllRoles();
    console.log(`✓ GET 200 ${allRoles.map((r) => r.name).join(', ')}`);

    // SEARCH roles
    console.log('\nSEARCH roles with "Administrateur"...');
    const searchResults = await searchRoles('Administrateur');
    console.log(`✓ SEARCH 200 ${searchResults.map((r) => r.name).join(', ')}`);

    // CREATE role
    console.log('\nCREATE new role "Test Manager"...');
    const newRole = await createRole('Test Manager', {
      clients: 'write',
      services: 'write',
      appointments: 'full',
      invoices: 'read',
      purchases: 'none',
      expenses: 'none',
      users: 'none',
      dashboard: 'read',
    });
    console.log(`✓ CREATE 201 ${newRole.name} (id: ${newRole.id})`);
    const testRoleId = newRole.id;

    // UPDATE role
    console.log('\nUPDATE role name to "Test Coordinator"...');
    const updated = await updateRole(testRoleId, 'Test Coordinator', {
      clients: 'full',
      services: 'read',
      appointments: 'full',
      invoices: 'write',
      purchases: 'read',
      expenses: 'read',
      users: 'none',
      dashboard: 'read',
    });
    console.log(`✓ UPDATE 200 ${updated.name}`);

    // SEARCH for updated role
    console.log('\nSEARCH for "Test Coordinator"...');
    const foundRole = await searchRoles('Test Coordinator');
    console.log(`✓ SEARCH 200 ${foundRole.map((r) => r.name).join(', ')}`);

    // DELETE role
    console.log('\nDELETE role...');
    await deleteRole(testRoleId);
    console.log(`✓ DELETE 200 success`);

    // Verify deletion with search
    console.log('\nVERIFY deletion - search for "Test Coordinator"...');
    const afterDelete = await searchRoles('Test Coordinator');
    if (afterDelete.length === 0) {
      console.log(`✓ VERIFY 200 role deleted successfully`);
    } else {
      throw new Error('Role still exists after deletion');
    }

    console.log('\n✅ All roles CRUD tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message, '\n');
    process.exit(1);
  }
}

main();
