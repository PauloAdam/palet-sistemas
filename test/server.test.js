import fs from 'fs/promises';
import path from 'path';

process.env.NODE_ENV = 'test';

const { startServer } = await import('../server.js');

const DB_PATH = path.resolve('database.json');

async function runTests(){
  const originalDb = await fs.readFile(DB_PATH, 'utf8');
  const server = startServer(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try{
    const healthRes = await fetch(`${baseUrl}/health`);
    if(!healthRes.ok) throw new Error('Health endpoint failed');

    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    if(!loginRes.ok) throw new Error('Login failed');
    const loginBody = await loginRes.json();
    if(!loginBody.token) throw new Error('Token missing');

    const token = loginBody.token;
    const palletPayload = { number: 'P-001', color: '#ffffff', products: ['A1', 'B2'] };

    const createRes = await fetch(`${baseUrl}/pallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(palletPayload)
    });
    if(createRes.status !== 201) throw new Error('Create pallet failed');

    const listRes = await fetch(`${baseUrl}/pallets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if(!listRes.ok) throw new Error('List pallets failed');
    const pallets = await listRes.json();
    if(!Array.isArray(pallets) || pallets.length === 0) throw new Error('Pallets missing');

    const deleteRes = await fetch(`${baseUrl}/pallets/0`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if(!deleteRes.ok) throw new Error('Delete pallet failed');

    console.log('All tests passed');
  }finally{
    server.close();
    await fs.writeFile(DB_PATH, originalDb, 'utf8');
  }
}

await runTests();
