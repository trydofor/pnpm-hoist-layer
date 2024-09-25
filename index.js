const version = '1.1.1';
const packageKey = 'hoistLayer';
const findOutKey = ':::HoistLayerJson:::';
const findEnvKey = 'HOIST_LAYER_FIND';
const debug = process.env['DEBUG'] != null;

if (debug) console.log(`🪝 HoistLayer ${version} debug pid=${process.pid}`);

function hoistLayerDeps(pkg, map, log) {
  const deps = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
  for (const dep of deps) {
    const idp = map.get(dep);
    if (idp != null) {
      log(`🪝 to ${pkg.name}, hoist ${dep}`);
      pkg.dependencies = { ...pkg.dependencies, ...idp.dependencies };
      pkg.devDependencies = { ...pkg.devDependencies, ...idp.devDependencies };
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

function loadHoistLayer(map, log) {
  const st = Date.now();
  const cmd = 'pnpm i -r -s --resolution-only';
  log(`🪝 Starting loadHoistLayer(${version}) by ${cmd}`);

  const output = require('child_process').execSync(cmd,
    {
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

  log('🪝 Found HoistLayer: ' + JSON.stringify(Array.from(map.keys())));
  const ct = ((Date.now() - st) / 1000).toFixed(2);
  log(`🪝 Finished loadHoistLayer in ${ct}s`);
}

const layerPkgMap = new Map(); // pkg.name -> {name, dependencies, devDependencies, hoistLayer? }
const layerStatus = { finding: process.env[findEnvKey] != null, loading: true };

function readPackage(pkg, context) {
  if (layerStatus.finding) return findHoistLayer(pkg, layerPkgMap);

  const log = debug ? console.log : context.log;
  if (debug) log(`readPackage-${process.pid}: pkg.name=${pkg.name}`);

  if (layerStatus.loading) {
    loadHoistLayer(layerPkgMap, log);
    layerStatus.loading = false;
  }

  if (Array.isArray(pkg[packageKey])) {
    hoistLayerDeps(pkg, layerPkgMap, log);
  }
  return pkg;
}


module.exports = {
  version,
  packageKey,
  hooks: {
    readPackage,
  },
};
