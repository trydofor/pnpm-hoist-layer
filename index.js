const version = '1.1.0';
const packageKey = 'hoistLayer';
const findOutKey = ':::HoistLayerJson:::';
const findEnvKey = 'HOIST_LAYER_FIND';
const debug = false;

function findHoistLayer(pkg) {
  const hls = pkg[packageKey];
  const hasLayer = Array.isArray(hls);

  if (debug) console.log(`DEBUG:${process.pid}: name=${pkg.name}, ${packageKey}= ${JSON.stringify(hls)}`);

  if (hasLayer) {
    for (const hl of hls) {
      layerPkgMap.set(hl, true);
    }
  }

  const dep = layerPkgMap.get(pkg.name);
  if (dep === true) {
    console.log(findOutKey + JSON.stringify({
      name: pkg.name,
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
    }));
  }

  return hasLayer ? pkg : { name: pkg.name, type: pkg.type, version: pkg.version };
}

function hoistLayerDeps(pkg, map, log) {
  const deps = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
  for (const dep of deps) {
    const idp = map.get(dep);
    if (idp != null) {
      log(`🪝 Hoisting ${dep} to ${pkg.name}`);
      pkg.dependencies = { ...pkg.dependencies, ...idp.dependencies };
      pkg.devDependencies = { ...pkg.devDependencies, ...idp.devDependencies };
    }
  }
}

function loadHoistLayer(map, log) {
  const st = Date.now();
  log(`🪝 Starting loadHoistLayer ${version}`);

  const output = require('child_process').execSync(
    'pnpm i --resolution-only --silent',
    {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, [findEnvKey]: 'true' },
    },
  ).toString();

  for (const line of output.split('\n')) {
    if (debug) log(`DEBUG:${process.pid}: ${line}`);
    if (!line.startsWith(findOutKey)) {
      continue;
    }
    const layer = JSON.parse(line.substring(findOutKey.length));
    map.set(layer.name, layer);
  };

  if (map.size > 0) {
    for (const pkg of map.values()) {
      hoistLayerDeps(pkg, map, log);
    }
    log('🪝 Found HoistLayer: ' + JSON.stringify(Array.from(map.keys())));
  }
  else {
    log('🪝 No HoistLayer found.');
  }
  const ct = ((Date.now() - st) / 1000).toFixed(2);
  log(`🪝 Finished loadHoistLayer in ${ct}s`);
}

const layerPkgMap = new Map(); // pkg.name -> true | {name, dependencies, devDependencies}
const layerStatus = { finding: process.env[findEnvKey] != null, loading: true };

function readPackage(pkg, context) {
  if (layerStatus.finding) {
    return findHoistLayer(pkg);
  }

  if (debug) context.log(`DEBUG:${process.pid}: pkg.name=${pkg.name}`);

  if (layerStatus.loading) {
    loadHoistLayer(layerPkgMap, context.log);
    layerStatus.loading = false;
  }

  if (Array.isArray(pkg[packageKey])) {
    hoistLayerDeps(pkg, layerPkgMap, context.log);
  }
  return pkg;
}

module.exports = {
  packageKey,
  hooks: {
    readPackage,
  },
};
