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
    throw new Error(`Login failed: ${await res.text()}`);
  }

  const data = await res.json();
  authToken = data.token;
  console.log('✓ Logged in as admin');
}

async function getRoles() {
  const res = await fetch(`${BASE_URL}/roles`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!res.ok) {
    throw new Error(`GET /api/roles failed: ${res.status}`);
  }

  return res.json();
}

async function getUsers() {
  const res = await fetch(`${BASE_URL}/users`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!res.ok) {
    throw new Error(`GET /api/users failed: ${res.status}`);
  }

  return res.json();
}

async function createUser(payload) {
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`POST /api/users failed: ${err.error || res.status}`);
  }

  return res.json();
}

async function updateUser(payload) {
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`PUT /api/users failed: ${err.error || res.status}`);
  }

  return res.json();
}

async function deleteUser(id) {
  const res = await fetch(`${BASE_URL}/users`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`DELETE /api/users failed: ${err.error || res.status}`);
  }

  return res.json();
}

async function main() {
  let testUserId = null;

  try {
    await login();

    const roles = await getRoles();
    const employeeRole = roles.find((role) => role.name === 'Employé') || roles[0];

    if (!employeeRole) {
      throw new Error('No role available to test users CRUD');
    }

    console.log('\n=== Testing Users CRUD ===\n');

    const beforeUsers = await getUsers();
    console.log(`✓ GET 200 ${beforeUsers.length} users`);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const created = await createUser({
      name: `Test Utilisateur ${uniqueSuffix}`,
      username: `testuser_${uniqueSuffix}`,
      password: 'Test12345!',
      roleId: employeeRole.id,
    });
    testUserId = created.id;
    console.log(`✓ CREATE 201 ${created.username} (${created.name})`);

    const afterCreateUsers = await getUsers();
    const createdInList = afterCreateUsers.find((user) => user.id === testUserId);
    if (!createdInList) {
      throw new Error('Created user not found in GET /api/users result');
    }

    const updated = await updateUser({
      id: testUserId,
      name: `Utilisateur Modifié ${uniqueSuffix}`,
      roleId: employeeRole.id,
      password: 'NewPass123!'
    });
    console.log(`✓ UPDATE 200 ${updated.username} -> ${updated.name}`);

    const deactivated = await deleteUser(testUserId);
    console.log(`✓ DELETE 200 active=${deactivated.active}`);

    if (deactivated.active !== false) {
      throw new Error('Delete did not deactivate user as expected');
    }

    const afterDeleteUsers = await getUsers();
    const deletedInList = afterDeleteUsers.find((user) => user.id === testUserId);
    if (!deletedInList || deletedInList.active !== false) {
      throw new Error('Deleted user not found as inactive in GET /api/users result');
    }

    console.log('\n✅ All users CRUD tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message, '\n');
    process.exitCode = 1;
  }
}

main();