// module.exports = require('pnpm-hoist-layer');
const version = '1.1.6';
const lockFile = 'hoist-layer.json';
const packageKey = 'hoistLayer';
const findOutKey = ':::HoistLayerJson:::';
const findEnvKey = 'HOIST_LAYER_FIND';
const findPrcCmd = 'pnpm -r i --resolution-only';
const debug = process.env['DEBUG'] != null;

const path = require('path');
const fs = require('fs');

if (debug) console.log(`🪝 HoistLayer ${version} debug pid=${process.pid}`);

function findHoistLayer(pkg, map) {
  const name = pkg.name;
  const hoistLayer = pkg[packageKey];
  const oldPkg = map.get(name);

  let skip = hoistLayer == null;

  if (oldPkg == null || oldPkg === true) {
    map.set(name, false);
    console.log(findOutKey + JSON.stringify({
      name,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      hoistLayer,
    }));

    if (oldPkg == null) {
      for (const dep of Object.keys(pkg.dependencies || {})) {
        map.set(dep, true);
      }
      for (const dep of Object.keys(pkg.devDependencies || {})) {
        map.set(dep, true);
      }
      skip = false;
    }
  }

  if (hoistLayer != null) {
    for (const ly of hoistLayer) {
      map.set(ly, true);
    }
  }

  if (skip) {
    if (debug) console.log(`🪝 findHoistLayer-${process.pid}: skip follow ${name}`);
    return { name, type: pkg.type, version: pkg.version };
  }

  return pkg;
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

  // from cache file
  if (locked) {
    log(`🪝 Starting loadLayerCache(${version}) by ${lockFile}`);

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

    return;
  }

  // from child process
  const cmd = debug ? findPrcCmd : `${findPrcCmd} -s`;
  log(`🪝 Starting loadLayerCache(${version}) by ${cmd}`);
  try {
    const output = require('child_process').execSync(cmd,
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

    const layersNeed = new Set(); // hoistLayer defined in current workspace/projects
    for (const pkg of map.values()) {
      const hl = pkg.hoistLayer;
      if (hl == null) continue;

      layersNeed.add(pkg.name);
      for (const pn of hl) {
        layersNeed.add(pn);
      }
    }

    if (debug) log(`loadHoistLayer-${process.pid}: need hoistLayer=${JSON.stringify(Array.from(layersNeed))}`);

    const directDeps = new Set(Array.from(map.keys()));
    for (const dk of directDeps) {
      if (!layersNeed.has(dk)) {
        if (debug) log(`loadHoistLayer-${process.pid}: removing non-layer package= ${dk}`);
        map.delete(dk);
      }
    }

    let miss = 0;
    for (const ln of layersNeed) {
      if (!map.has(ln)) {
        miss++;
        log(`❌ loadHoistLayer-${process.pid}: missing layer package= ${ln}`);
      }
    }

    if (miss > 0) {
      log(`🔆 the missing layer should be explicitly defined, one of the following,`);
      log(`🔆 (1) one top-project "${packageKey}" + sub's deps in "optionalDependencies" `);
      log(`🔆 (2) every sub "${packageKey}" + its deps in "*Dependencies"`);
      process.exit(1);
    }

    // flat layers
    for (const pkg of map.values()) {
      for (const name of map.keys()) {
        if (pkg.dependencies[name] == null && pkg.devDependencies[name] == null) continue;
        const layer = map.get(name);
        log(`🔀 to ${pkg.name} merge ${name}`);
        if (debug) log(`🔀 dependencies=${JSON.stringify(pkg.dependencies, null, 2)}, merge=${JSON.stringify(layer.dependencies, null, 2)}`);
        pkg.dependencies = { ...pkg.dependencies, ...layer.dependencies };

        if (debug) log(`🔀 devDependencies=${JSON.stringify(pkg.devDependencies, null, 2)}, merge=${JSON.stringify(layer.devDependencies, null, 2)}`);
        pkg.devDependencies = { ...pkg.devDependencies, ...layer.devDependencies };
      }
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
  let i = 1;
  for (const layer of map.values()) {
    log(`🪝 HoistLayer[${i++}] name=${layer.name} (deps=${Object.keys(layer.dependencies).length},devDeps=${Object.keys(layer.devDependencies).length})`);
  }
  const ct = ((Date.now() - st) / 1000).toFixed(2);
  log(`🪝 Finished loadHoistLayer in ${ct}s`);
}

// findHoistLayer: pkg.name -> boolean, null:first, true:deps, false:skip
// {name, dependencies, devDependencies, hoistLayer? }
const layerPkgMap = new Map();
const layerStatus = { finding: process.env[findEnvKey] != null, loading: true };

//// the hook ////
function readPackage(pkg, context) {
  if (layerStatus.finding) {
    return findHoistLayer(pkg, layerPkgMap);
  }

  const log = debug ? console.log : context.log;
  if (debug) log(`readPackage-${process.pid}: pkg.name=${pkg.name}`);

  if (layerStatus.loading) {
    loadHoistLayer(layerPkgMap, log);
    layerStatus.loading = false;
  }

  // reuse merged layer deps (no devDependencies while only `install`)
  const thisLayer = layerPkgMap.get(pkg.name);
  if (thisLayer != null) {
    pkg.dependencies = { ...thisLayer.dependencies };
    pkg.devDependencies = { ...thisLayer.devDependencies };
    const deps2 = Object.keys(thisLayer.dependencies).length;
    const devs2 = Object.keys(thisLayer.devDependencies).length;
    log(`⬆️ to ${pkg.name} hoist itself (deps=${deps2},devDeps=${devs2})`);
    return pkg;
  }

  // hoist deps. no devDependencies while installing, unlike resolving
  const pkgAndDeps = [Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
  for (const dep of pkgAndDeps) {
    const layer = layerPkgMap.get(dep);
    if (layer == null) continue;
    const deps0 = Object.keys(pkg.dependencies).length;
    const devs0 = Object.keys(pkg.devDependencies).length;
    pkg.dependencies = { ...pkg.dependencies, ...layer.dependencies };
    pkg.devDependencies = { ...pkg.devDependencies, ...layer.devDependencies };
    const deps1 = Object.keys(layer.dependencies).length;
    const devs1 = Object.keys(layer.devDependencies).length;
    const deps2 = Object.keys(pkg.dependencies).length;
    const devs2 = Object.keys(pkg.devDependencies).length;
    log(`⬆️ to ${pkg.name} hoist ${layer.name} (deps=${deps2},devDeps=${devs2})=(${deps0},${devs0})+(${deps1},${devs1})`);
  }

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
