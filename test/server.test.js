import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.resolve('database.json');

async function runTests(){
  const content = await fs.readFile(DB_PATH, 'utf8');
  const data = JSON.parse(content);

  if(!Array.isArray(data.users) || data.users.length === 0){
    throw new Error('database.json must include users');
  }
  const admin = data.users.find(u => u.username === 'admin');
  if(!admin || !admin.password || admin.role !== 'admin'){
    throw new Error('admin user missing or invalid');
  }
  const func = data.users.find(u => u.username === 'func');
  if(!func || !func.password){
    throw new Error('func user missing or invalid');
  }
  if(!Array.isArray(data.pallets)){
    throw new Error('database.json must include pallets array');
  }

  console.log('Local data checks passed');
}

await runTests();
