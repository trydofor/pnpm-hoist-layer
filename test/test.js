const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function reset(repo) {
  const dirs = fs.readdirSync(repo, { withFileTypes: true });
  for (const dir of dirs) {
    const dr = dir.name;
    const pt = path.join(repo, dr);
    if (dr === 'node_modules') {
      fs.rmSync(pt, { recursive: true });
    }
    else if (dr === 'pnpm-lock.yaml' || dr === '.npmrc') {
      fs.unlinkSync(pt);
    }
    else if (dir.isDirectory()) {
      reset(pt);
    }
  }
}

function scan(repo) {
  const flat = [];
  const dirs = fs.readdirSync(repo, { withFileTypes: true });
  for (const dir of dirs) {
    const dr = dir.name;
    const pt = path.join(repo, dr);
    if (dr === 'node_modules') {
      const deps = fs.readdirSync(pt, { withFileTypes: true });
      for (const dep of deps) {
        if (!dep.name.startsWith('.')) {
          const rp = path.join(pt, dep.name).substring(__dirname.length + 1);
          flat.push(rp);
        }
      }
    }
    else if (dir.isDirectory()) {
      flat.push(...scan(pt));
    }
  }

  return flat;
}

function init(prj, cmd, npmrc) {
  // clean node_modules, pnpm-lock.yaml, .npmrc
  reset(prj);

  // write .npmrc
  if (npmrc && Object.keys(npmrc).length > 0) {
    let str = '';
    for (let key in npmrc) {
      str += `${key}=${npmrc[key]}\n`;
    }
    fs.writeFileSync(path.resolve(prj, '.npmrc'), str);
  }

  // install
  execSync(cmd, { stdio: 'ignore', cwd: prj });

  // scan deps from node_modules
  return scan(prj);
}

function test(repo, npmrc) {
  const prj = path.resolve(__dirname, repo.name);

  const deps1 = init(prj, 'pnpm -r i --ignore-pnpmfile', npmrc);
  const deps2 = init(prj, 'pnpm -r i', npmrc);

  // check
  const set1 = new Set(deps1);
  let len1 = repo.before.length;
  for (const dep of repo.before) {
    if (set1.delete(dep)) {
      len1--;
    }
  }

  const set2 = new Set(deps2);
  let len2 = repo.after.length;
  for (const dep of repo.after) {
    if (set2.delete(dep)) {
      len2--;
    }
  }

  if (set1.size === 0 && len1 === 0 && set2.size === 0 && len2 === 0) {
    console.log(`✅ Success ${repo.name}, npmrc=${JSON.stringify(npmrc)}`);
  }
  else {
    console.log(`❌ Failed ${repo.name}, npmrc=${JSON.stringify(npmrc)}`);
    if (set1.size !== 0 || len1 !== 0) {
      console.log('⭕️ before expect: ' + JSON.stringify(repo.before, null, 2));
      console.log('❌ before actual: ' + JSON.stringify(deps1, null, 2));
    }
    if (set2.size !== 0 || len2 !== 0) {
      console.log('⭕️  after expect: ' + JSON.stringify(repo.after, null, 2));
      console.log('❌  after actual: ' + JSON.stringify(deps2, null, 2));
    }
    process.exit(1);
  }
}

const repos = [
  {
    name: 'mono',
    npmrc: [{}, { 'shared-workspace-lockfile': false }],
    before: [
      'mono/packages/pkg0/node_modules/mono-test-1',
      'mono/packages/pkg1/node_modules/mono-test-2',
      'mono/packages/pkg2/node_modules/solo-dev-dep',
      'mono/packages/pkg2/node_modules/solo-prd-dep',
    ],
    after: [
      'mono/packages/pkg0/node_modules/solo-dev-dep',
      'mono/packages/pkg0/node_modules/solo-prd-dep',
      'mono/packages/pkg0/node_modules/mono-test-1',
      'mono/packages/pkg0/node_modules/mono-test-2',
      'mono/packages/pkg1/node_modules/solo-dev-dep',
      'mono/packages/pkg1/node_modules/solo-prd-dep',
      'mono/packages/pkg1/node_modules/mono-test-2',
      'mono/packages/pkg2/node_modules/solo-dev-dep',
      'mono/packages/pkg2/node_modules/solo-prd-dep',
    ],
  },
  {
    name: 'poly',
    before: [
      'poly/packages/pkg0/node_modules/poly-test-1',
      'poly/packages/pkg1/node_modules/poly-test-2',
      'poly/packages/pkg2/node_modules/solo-dev-dep',
      'poly/packages/pkg2/node_modules/solo-prd-dep',
    ],
    after: [
      'poly/packages/pkg0/node_modules/solo-dev-dep',
      'poly/packages/pkg0/node_modules/solo-prd-dep',
      'poly/packages/pkg0/node_modules/poly-test-1',
      'poly/packages/pkg0/node_modules/poly-test-2',
      'poly/packages/pkg1/node_modules/solo-dev-dep',
      'poly/packages/pkg1/node_modules/solo-prd-dep',
      'poly/packages/pkg1/node_modules/poly-test-2',
      'poly/packages/pkg2/node_modules/solo-dev-dep',
      'poly/packages/pkg2/node_modules/solo-prd-dep',
    ],
  }];

for (const repo of repos) {
  if (process.argv.includes('--reset')) {
    console.log(`🔥 reset ${repo.name}`);
    reset(path.resolve(__dirname, repo.name));
  }
  else {
    if (repo.npmrc) {
      for (const rc of repo.npmrc) {
        test(repo, rc);
      }
    }
    else {
      test(repo, {});
    }
  }
}
