const findOutKey = ':::HoistLayerJson:::';
const packageKey = 'hoistLayer';

// the template begin
// findHoistLayer: pkg.name -> boolean, null:first, true:deps, false:skip
// {name, dependencies, devDependencies, hoistLayer? }
const layerPkgMap = new Map();
function readPackage(pkg) {
  const hoistLayer = pkg[packageKey];
  const oldPkg = layerPkgMap.get(pkg.name);

  let skip = hoistLayer == null;

  if (oldPkg == null || oldPkg === true) {
    layerPkgMap.set(pkg.name, false);
    console.log(findOutKey + JSON.stringify({
      name: pkg.name,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      hoistLayer,
    }));

    if (oldPkg == null) {
      for (const dep of Object.keys(pkg.dependencies || {})) {
        layerPkgMap.set(dep, true);
      }
      for (const dep of Object.keys(pkg.devDependencies || {})) {
        layerPkgMap.set(dep, true);
      }
      skip = false;
    }
  }

  for (const ly of hoistLayer || []) {
    layerPkgMap.set(ly, true);
  }

  return skip ? { name: pkg.name, type: pkg.type, version: pkg.version } : pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
// the template end
