(async () => {
  const base = 'http://localhost:5000/api';
  const email = 'olivia@wizzybug.io';
  const password = 'password123';

  try {
    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await loginRes.json().catch(() => null);
    console.log('LOGIN status', loginRes.status);
    console.log('LOGIN body', JSON.stringify(loginBody, null, 2));

    if (!loginRes.ok) process.exit(1);

    const token = loginBody.token;
    const projRes = await fetch(`${base}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'E2E Project Olivia', description: 'Created by Olivia via E2E test' }),
    });
    const projBody = await projRes.json().catch(() => null);
    console.log('PROJECT status', projRes.status);
    console.log('PROJECT body', JSON.stringify(projBody, null, 2));
  } catch (err) {
    console.error('E2E error', err);
    process.exit(1);
  }
})();
