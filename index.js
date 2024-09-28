const version = '1.1.4';
const lockFile = 'hoist-layer.json';
const packageKey = 'hoistLayer';
const findOutKey = ':::HoistLayerJson:::';
const findEnvKey = 'HOIST_LAYER_FIND';
const findPrcCmd = 'pnpm -r i --resolution-only';
const debug = process.env['DEBUG'] != null;

const path = require('path');
const fs = require('fs');

if (debug) console.log(`🪝 HoistLayer ${version} debug pid=${process.pid}`);

function hoistLayerDeps(pkg, map, log) {
  for (const layer of map.values()) {
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const name = layer.name;
    if (deps[name] != null || devDeps[name] != null) {
      log(`🪝 to ${pkg.name}, hoist ${name}`);
      pkg.dependencies = { ...deps, ...layer.dependencies };
      pkg.devDependencies = { ...devDeps, ...layer.devDependencies };
    }
  }
}

function findHoistLayer(pkg, map) {
  const hls = pkg[packageKey];

  const pn = pkg.name;
  if (!map.has(pn)) {
    const npk = {
      name: pn,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
      hoistLayer: hls,
    };
    map.set(pn, npk);
    console.log(findOutKey + JSON.stringify(npk));
  }

  return hls != null ? pkg : { name: pkg.name, type: pkg.type, version: pkg.version };
}

function findPnpmFile(rt, max = 5) {
  let pt = rt;
  for (let i = 0; i < max; i++) {
    if (fs.existsSync(path.join(pt, '.pnpmfile.cjs'))) {
      return pt;
    }
    pt = path.dirname(pt);
  }
  return null;
}

function loadLayerCache(cwd, map, log) {
  const locked = process.argv.includes('--no-frozen-lockfile') ? false : process.argv.includes('--frozen-lockfile');
  const lockPath = path.join(cwd, lockFile);

  if (locked) {
    if (!fs.existsSync(lockPath)) {
      log(`❌ ${lockFile} not found, use --no-frozen-lockfile to generate`);
      process.exit(1);
    }
    const pkgArr = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (!Array.isArray(pkgArr)) {
      log(`❌ ${lockFile} is not an array`);
      process.exit(1);
    }

    for (const pkg of pkgArr) {
      map.set(pkg.name, pkg);
    }

    if (debug) log(`🪝 loaded from ${lockFile} with ${map.size} packages`);
    return;
  }

  try {
    const output = require('child_process').execSync(findPrcCmd,
      {
        cwd,
        stdio: ['ignore', 'pipe', 'inherit'],
        env: { ...process.env, [findEnvKey]: 'true' },
      },
    ).toString();

    for (const line of output.split('\n')) {
      if (debug) log(`loadHoistLayer-${process.pid}: ${line}`);
      if (!line.startsWith(findOutKey)) {
        continue;
      }
      const layer = JSON.parse(line.substring(findOutKey.length));
      map.set(layer.name, layer);
    };

    const hls = new Set(); // hoistLayer names
    for (const pkg of map.values()) {
      const hl = pkg.hoistLayer;
      if (hl == null) continue;
      for (const pn of hl) {
        hls.add(pn);
      }
    }

    if (debug) log(`loadHoistLayer-${process.pid}: hoistLayer=${JSON.stringify(Array.from(hls))}`);

    const rms = new Set(Array.from(map.keys()));
    for (const hl of rms) {
      if (!hls.has(hl)) {
        if (debug) log(`loadHoistLayer-${process.pid}: removing ${hl}`);
        map.delete(hl);
      }
    }

    for (const pkg of map.values()) {
      hoistLayerDeps(pkg, map, log);
    }
    // write to lock file
    const sortedArr = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(lockPath, JSON.stringify(sortedArr, null, 2));
  }
  catch (err) {
    log(`🐞 to debug 🐞 ${findPrcCmd} --ignore-pnpmfile`);
    log(`❌ failed to loadHoistLayer,`);
    if (err.stdout) {
      log(`❌ stdout : \n${err.stdout.toString()}`);
    }
    if (err.stderr) {
      log(`❌ stderr : \n${err.stderr.toString()}`);
    }
    process.exit(1);
  }
}

function loadHoistLayer(map, log) {
  const st = Date.now();
  // const cmd = debug ? findPrcCmd : `${findPrcCmd} -s`;
  // log(`🪝 Starting loadHoistLayer(${version}) by ${cmd}`);
  const cwd = process.cwd();
  log(`🪝 current working=${cwd}`);
  const pfd = findPnpmFile(cwd, 5);
  if (pfd != null) {
    log(`🪝 workspaces root=${pfd}`);
    if (pfd !== cwd) {
      log(`❌ should run in workspaces root=${pfd}`);
      log(`⭕️ layer hoisting will work, use --ignore-pnpmfile to debug`);
      process.exit(1);
    }
  }

  loadLayerCache(pfd == null ? cwd : pfd, map, log);

  log('🪝 Found HoistLayer: ' + JSON.stringify(Array.from(map.keys())));
  const ct = ((Date.now() - st) / 1000).toFixed(2);
  log(`🪝 Finished loadHoistLayer in ${ct}s`);
}

const layerPkgMap = new Map(); // pkg.name -> {name, dependencies, devDependencies, hoistLayer? }
const layerStatus = { finding: process.env[findEnvKey] != null, loading: true };

//// the hook ////
function readPackage(pkg, context) {
  if (layerStatus.finding) return findHoistLayer(pkg, layerPkgMap);

  const log = debug ? console.log : context.log;
  if (debug) log(`readPackage-${process.pid}: pkg.name=${pkg.name}`);

  if (layerStatus.loading) {
    loadHoistLayer(layerPkgMap, log);
    layerStatus.loading = false;
  }

  hoistLayerDeps(pkg, layerPkgMap, log);
  return pkg;
}

module.exports = {
  version,
  lockFile,
  packageKey,
  hooks: {
    readPackage,
  },
};
