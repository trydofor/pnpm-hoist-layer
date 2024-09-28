const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function reset(top) {
  const dirs = fs.readdirSync(top, { withFileTypes: true });
  for (const dir of dirs) {
    const dr = dir.name;
    const pt = path.join(top, dr);
    if (dr === 'node_modules') {
      fs.rmSync(pt, { recursive: true });
    }
    else if (dr === 'pnpm-lock.yaml' || dr === '.npmrc' || dr === 'hoist-layer.json') {
      fs.unlinkSync(pt);
    }
    else if (dir.isDirectory()) {
      reset(pt);
    }
  }
}

function scan(top, cut) {
  const flat = [];
  const dirs = fs.readdirSync(top, { withFileTypes: true });
  for (const dir of dirs) {
    const dr = dir.name;
    const pt = path.join(top, dr);
    if (dr === 'node_modules') {
      const deps = fs.readdirSync(pt, { withFileTypes: true });
      for (const dep of deps) {
        if (!dep.name.startsWith('.')) {
          const rp = path.join(pt, dep.name).substring(cut);
          flat.push(rp);
        }
      }
    }
    else if (dir.isDirectory()) {
      flat.push(...scan(pt, cut));
    }
  }

  return flat;
}

function init(top, cmd, rc) {
  // write .npmrc
  if (rc && Object.keys(rc).length > 0) {
    let str = '';
    for (let key in rc) {
      str += `${key}=${rc[key]}\n`;
    }
    fs.writeFileSync(path.resolve(top, '.npmrc'), str);
  }

  // install
  execSync(cmd, { stdio: 'inherit', cwd: top });
}

function test(prj, bef, aft, rc) {
  console.log(`🧪 ${prj} ======================`);
  console.log(`🧪 Testing ${prj}, npmrc=${JSON.stringify(rc)}`);
  const top = path.resolve(__dirname, prj);
  const cut = top.length + 1;

  console.log(`🧪 ${prj} plain > pnpm -r i --ignore-pnpmfile`);
  reset(top);
  init(top, 'pnpm -r i --ignore-pnpmfile', rc);
  const rs1 = scan(top, cut);

  console.log(`🧪 ${prj} hoist> pnpm -r i`);
  reset(top);
  init(top, 'pnpm -r i', rc);
  const rs2 = scan(top, cut);

  // ci check
  console.log(`🧪 ${prj} pnpm -r i --frozen-lockfile`);
  init(top, 'pnpm -r i --frozen-lockfile', rc);
  const rs3 = scan(top, cut);

  // check
  const strBef = JSON.stringify(bef.sort(), null, 2);
  const strAft = JSON.stringify(aft.sort(), null, 2);

  const strRs1 = JSON.stringify(rs1.sort(), null, 2);
  const strRs2 = JSON.stringify(rs2.sort(), null, 2);
  const strRs3 = JSON.stringify(rs3.sort(), null, 2);

  const okRs1 = strBef === strRs1;
  const okRs2 = strAft === strRs2;
  const okRs3 = strRs2 === strRs3;

  if (okRs1 && okRs2 && okRs3) {
    console.log(`✅ Success ${prj}, npmrc=${JSON.stringify(rc)}`);
    console.log('\n');
  }
  else {
    console.log(`❌ Failed ${prj}, npmrc=${JSON.stringify(rc)}`);
    if (!okRs1) {
      console.log(`⭕️ plain expect: ${strBef}`);
      console.log(`❌ plain actual: ${strRs1}`);
    }
    if (!okRs2) {
      console.log(`⭕️ hoist expect: ${strAft}`);
      console.log(`❌ hoist actual: ${strRs2}`);
    }
    if (!okRs3) {
      console.log(`⭕️ hoist expect: ${strRs2}`);
      console.log(`❌ hoist ci actual: ${strRs3}`);
    }
    process.exit(1);
  }
}

const repos = [
  {
    path: ['mono1', 'mono2'],
    npmrc: [{}, { 'shared-workspace-lockfile': false }],
    plain: [
      'packages/pkg0/node_modules/mono-test-1',
      'packages/pkg1/node_modules/mono-test-2',
      'packages/pkg2/node_modules/solo-dev-dep',
      'packages/pkg2/node_modules/solo-prd-dep',
    ],
    hoist: [
      'packages/pkg0/node_modules/solo-dev-dep',
      'packages/pkg0/node_modules/solo-prd-dep',
      'packages/pkg0/node_modules/mono-test-1',
      'packages/pkg0/node_modules/mono-test-2',
      'packages/pkg1/node_modules/solo-dev-dep',
      'packages/pkg1/node_modules/solo-prd-dep',
      'packages/pkg1/node_modules/mono-test-2',
      'packages/pkg2/node_modules/solo-dev-dep',
      'packages/pkg2/node_modules/solo-prd-dep',
    ],
  },
  {
    path: ['poly1', 'poly2'],
    plain: [
      'packages/pkg0/node_modules/poly-test-1',
      'packages/pkg1/node_modules/poly-test-2',
      'packages/pkg2/node_modules/solo-dev-dep',
      'packages/pkg2/node_modules/solo-prd-dep',
    ],
    hoist: [
      'packages/pkg0/node_modules/solo-dev-dep',
      'packages/pkg0/node_modules/solo-prd-dep',
      'packages/pkg0/node_modules/poly-test-1',
      'packages/pkg0/node_modules/poly-test-2',
      'packages/pkg1/node_modules/solo-dev-dep',
      'packages/pkg1/node_modules/solo-prd-dep',
      'packages/pkg1/node_modules/poly-test-2',
      'packages/pkg2/node_modules/solo-dev-dep',
      'packages/pkg2/node_modules/solo-prd-dep',
    ],
  }];

for (const repo of repos) {
  if (process.argv.includes('--reset')) {
    for (const pt of repo.path) {
      console.log(`🔥 reset ${pt}`);
      reset(path.resolve(__dirname, pt));
    }
  }
  else {
    for (const pt of repo.path) {
      const rcs = repo.npmrc || [{}];
      for (const rc of rcs) {
        test(pt, repo.plain, repo.hoist, rc);
      }
    }
  }
}
