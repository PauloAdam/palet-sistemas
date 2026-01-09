import fs from 'fs/promises';
import path from 'path';

const files = [
  { file: 'login.html', selectors: ['id="btnLogin"', 'id="btnOffline"', 'id="username"', 'id="password"'] },
  { file: 'sistema.html', selectors: [
    'id="logoutBtn"',
    'id="btnNew"',
    'id="btnExport"',
    'id="btnImport"',
    'id="btnSeparate"',
    'id="btnPdfPortrait"',
    'id="btnPdfLandscape"',
    'id="savePallet"',
    'id="deletePallet"'
  ] }
];

async function runUiTests(){
  for(const { file, selectors } of files){
    const content = await fs.readFile(path.resolve(file), 'utf8');
    for(const selector of selectors){
      if(!content.includes(selector)){
        throw new Error(`Missing ${selector} in ${file}`);
      }
    }
  }
  console.log('UI checks passed');
}

await runUiTests();
