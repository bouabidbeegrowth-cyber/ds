const BASE_URL = 'http://localhost:3000/api';

function formatDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  if (!res.ok) {
    throw new Error(`Login failed: ${await res.text()}`);
  }

  const data = await res.json();
  return data.token;
}

async function request(path, token, method, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return { ok: res.ok, status: res.status, data: json };
}

async function getEmployeeRoleId(token) {
  const res = await request('/roles', token, 'GET');
  if (!res.ok) throw new Error(`GET /roles failed: ${res.status}`);
  const role = res.data.find((item) => item.name === 'Employé') || res.data[0];
  if (!role) throw new Error('No role available');
  return role.id;
}

async function main() {
  const token = await login();
  await getEmployeeRoleId(token);

  console.log('=== Date validation checks ===');

  const yesterday = formatDate(-1);
  const today = formatDate(0);
  const tomorrow = formatDate(1);

  // Purchases: past date rejected, today accepted, update to future accepted, update to past rejected
  let purchaseId = null;
  let expenseId = null;

  const pastPurchase = await request('/purchases', token, 'POST', {
    label: 'Past Purchase',
    amount: 100,
    date: yesterday,
  });
  console.log(`PURCHASE past POST => ${pastPurchase.status} ${pastPurchase.data?.error || 'ok'}`);

  const todayPurchase = await request('/purchases', token, 'POST', {
    label: 'Today Purchase',
    amount: 100,
    date: today,
  });
  console.log(`PURCHASE today POST => ${todayPurchase.status} ${todayPurchase.data?.label || 'no label'}`);
  if (!todayPurchase.ok) throw new Error('Today purchase should be accepted');
  purchaseId = todayPurchase.data.id;

  const purchaseFutureUpdate = await request('/purchases', token, 'PUT', {
    id: purchaseId,
    date: tomorrow,
  });
  console.log(`PURCHASE future PUT => ${purchaseFutureUpdate.status} ${purchaseFutureUpdate.data?.date || 'ok'}`);
  if (!purchaseFutureUpdate.ok) throw new Error('Future purchase update should be accepted');

  const purchasePastUpdate = await request('/purchases', token, 'PUT', {
    id: purchaseId,
    date: yesterday,
  });
  console.log(`PURCHASE past PUT => ${purchasePastUpdate.status} ${purchasePastUpdate.data?.error || 'ok'}`);

  // Expenses: past date rejected, today accepted, update to future accepted, update to past rejected
  const pastExpense = await request('/expenses', token, 'POST', {
    label: 'Past Expense',
    category: 'AUTRE',
    amount: 100,
    date: yesterday,
  });
  console.log(`EXPENSE past POST => ${pastExpense.status} ${pastExpense.data?.error || 'ok'}`);

  const todayExpense = await request('/expenses', token, 'POST', {
    label: 'Today Expense',
    category: 'AUTRE',
    amount: 100,
    date: today,
  });
  console.log(`EXPENSE today POST => ${todayExpense.status} ${todayExpense.data?.label || 'no label'}`);
  if (!todayExpense.ok) throw new Error('Today expense should be accepted');
  expenseId = todayExpense.data.id;

  const expenseFutureUpdate = await request('/expenses', token, 'PUT', {
    id: expenseId,
    date: tomorrow,
  });
  console.log(`EXPENSE future PUT => ${expenseFutureUpdate.status} ${expenseFutureUpdate.data?.date || 'ok'}`);
  if (!expenseFutureUpdate.ok) throw new Error('Future expense update should be accepted');

  const expensePastUpdate = await request('/expenses', token, 'PUT', {
    id: expenseId,
    date: yesterday,
  });
  console.log(`EXPENSE past PUT => ${expensePastUpdate.status} ${expensePastUpdate.data?.error || 'ok'}`);

  // Cleanup
  if (purchaseId) {
    await request('/purchases', token, 'DELETE', { id: purchaseId });
  }
  if (expenseId) {
    await request('/expenses', token, 'DELETE', { id: expenseId });
  }

  console.log('\n✅ Date validation checks completed.');
}

main().catch((error) => {
  console.error('\n❌ Date validation check failed:', error.message);
  process.exit(1);
});