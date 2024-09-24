# 🪝 pnpm-hoist-layer

use `.pnpmfile.cjs` to hoist deps by project like
[nuxt layer](https://nuxt.com/docs/getting-started/layers)

## Purpose

pnpm [public-hoist-pattern](https://pnpm.io/npmrc#public-hoist-pattern)
only affects to the top-project (virtual store), not the sub-projects,
as Nuxt layer, we do not want to copy deps/devDeps from here to there,
so we want to hoist the layer's deps to the project.

e.g. `common->@nuxt`, `mobile->common`, but omit `@nuxt`

### before - no nuxt in mobile

```tree
├── common
│   ├── node_modules
│   │   ├── @nuxt -> ../.pnpm/...
└── mobile
    ├── node_modules
    │   ├── @fessional
    │   │   └── razor-common -> ../.pnpm/...
```

### after - hoist nuxt by common

```tree
└── mobile
    ├── node_modules
    │   ├── @fessional
    │   │   └── razor-common -> ../.pnpm/...
    │   ├── @nuxt -> ../.pnpm/... // ✅ hoist as layer
```

## Usage

add the `layer` deps to the following fields in package.json

* `hoistLayer` - to hoist the deps of the layer
* `dependencies` or `devDependencies` - for the package manager

NOTE: do NOT use [`link:`](https://pnpm.io/cli/link), as it will
not hook [`readPackage`](https://pnpm.io/pnpmfile)

```diff
  "devDependencies": {
+   "@fessional/razor-common": "file:../common",
  },
+ "hoistLayer": [
+   "@fessional/razor-common",
+ ]
```

hook and hoist deps by layers project

```bash
## 🪝 opt-1: global install and require
pnpm add -g pnpm-hoist-layer
cat > .pnpmfile.cjs << 'EOF'
module.exports = (() => {
  try {
    return require('pnpm-hoist-layer');
  }
  catch {
    const gr = require('child_process').execSync('pnpm root -g').toString().trim();
    return require(require('path').join(gr, 'pnpm-hoist-layer'));
  }
})();
EOF

## 🪝 opt-2: write to .pnpmfile.cjs
curl -o .pnpmfile.cjs https://raw.githubusercontent.com/trydofor\
/pnpm-hoist-layer/main/index.js
```

## Useful commands

```bash
## install pkgs
pnpm i
## rebuild cached
pnpm i --resolution-only
## skip if error
pnpm i --ignore-pnpmfile --ignore-scripts

## for asdf manager
export PNPM_HOME="$(asdf where pnpm)/bin"
export PATH="$PNPM_HOME:$PATH"
pnpm -g add pnpm-hoist-layer
```

## License

MIT
