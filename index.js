// module.exports = require('pnpm-hoist-layer');
const version = '1.1.7';
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

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort((a, b) => a[0].localeCompare(b[0])))
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

    const layerRef = new Set(); // hoistLayer defined in current workspace/projects
    for (const pkg of map.values()) {
      const hl = pkg.hoistLayer;
      if (hl == null) continue;

      layerRef.add(pkg.name);
      for (const pn of hl) {
        layerRef.add(pn);
      }
    }

    if (debug) {
      log(`loadHoistLayer-${process.pid}: hoistLayer=${JSON.stringify(Array.from(layerRef))}`);
    } else {
      log(`🪝 hoist=${JSON.stringify(Array.from(layerRef))}`);
    }

    const directDeps = new Set(Array.from(map.keys()));
    for (const dk of directDeps) {
      if (!layerRef.has(dk)) {
        if (debug) log(`loadHoistLayer-${process.pid}: removing non-layer package= ${dk}`);
        map.delete(dk);
      }
    }

    let miss = 0;
    for (const ln of layerRef) {
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

    // flat layers. pnpm may disorder to deps tree,
    // e.g.["mono-test-1","mono-test-2","mono-test-0"], ["mono-test-0","mono-test-1","mono-test-2"]
    const layerArr = Array.from(map.values());
    for (const pkg of layerArr) {
      const lys = new Map(map);
      let udp;
      do {
        udp = false;
        for (const [nm, ly] of lys) {
          if (pkg.dependencies[nm] == null && pkg.devDependencies[nm] == null) continue;

          if (debug) {
            log(`flat ${pkg.name} deps=${JSON.stringify(pkg.dependencies, null, 2)}, with=${JSON.stringify(ly.dependencies, null, 2)}`);
            log(`flat ${pkg.name} devDeps=${JSON.stringify(pkg.devDependencies, null, 2)}, with=${JSON.stringify(ly.devDependencies, null, 2)}`);
          }

          for (const [k, v] of Object.entries(ly.dependencies)) {
            if (pkg.dependencies[k] != null) continue;
            pkg.dependencies[k] = v;
            udp = true;
          }
          for (const [k, v] of Object.entries(ly.devDependencies)) {
            if (pkg.devDependencies[k] != null) continue;
            pkg.devDependencies[k] = v;
            udp = true;
          }

          if (udp) {
            lys.delete(nm);
            log(`🔀 flat ${pkg.name} with ${nm}`);
          }
        }
      } while (udp);
    }

    // sort deps by name
    for (const pkg of layerArr) {
      pkg.dependencies = sortObject(pkg.dependencies);
      pkg.devDependencies = sortObject(pkg.devDependencies);
    }
    // sort layer by name
    layerArr.sort((a, b) => a.name.localeCompare(b.name));

    // write to lock file
    fs.writeFileSync(lockPath, JSON.stringify(layerArr, null, 2));
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
    log(`⬆ to ${pkg.name} hoist itself (deps=${deps2},devDeps=${devs2})`);
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
    log(`⬆ to ${pkg.name} hoist ${layer.name} (deps=${deps2},devDeps=${devs2})=(${deps0},${devs0})+(${deps1},${devs1})`);
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
