const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const path = require('node:path');

const projectDirectory = process.cwd();

function findTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findTestFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.test.js') ? [entryPath] : [];
    })
    .sort();
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: projectDirectory,
    env: process.env,
    stdio: 'inherit',
  });
}

function exitCodeOf(result) {
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error('\nDocker não foi encontrado. Instale e inicie o Docker antes de executar npm test.');
    } else {
      console.error(`\nNão foi possível iniciar os testes: ${result.error.message}`);
    }
    return 1;
  }
  return result.status ?? 1;
}

console.log('\n[tests] Iniciando o PostgreSQL isolado...');
const databaseStart = run('docker', [
  'compose', '--profile', 'test', 'up', '-d', '--wait', 'db-test',
]);
const databaseStartCode = exitCodeOf(databaseStart);

if (databaseStartCode !== 0) {
  console.error('\n[tests] Não foi possível iniciar o banco de testes. Verifique se o Docker está em execução.');
  process.exit(databaseStartCode);
}

let testCode = 1;
try {
  console.log('\n[tests] Executando testes unitários, integrados e funcionais...');
  const testFiles = [
    ...findTestFiles(path.join(projectDirectory, 'test', 'unit')),
    ...findTestFiles(path.join(projectDirectory, 'test', 'integration')),
  ];
  const tests = run(process.execPath, [
    '--env-file=.env.test',
    '--test',
    '--test-concurrency=1',
    ...testFiles,
  ]);
  testCode = exitCodeOf(tests);
} finally {
  console.log('\n[tests] Encerrando o PostgreSQL isolado...');
  const databaseStop = run('docker', [
    'compose', '--profile', 'test', 'rm', '-sf', 'db-test',
  ]);
  const databaseStopCode = exitCodeOf(databaseStop);
  if (testCode === 0 && databaseStopCode !== 0) testCode = databaseStopCode;
}

process.exit(testCode);
