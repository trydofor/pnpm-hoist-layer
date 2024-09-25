# 🪝 pnpm-hoist-layer

use `.pnpmfile.cjs` to hoist deps by project like
[nuxt layer](https://nuxt.com/docs/getting-started/layers)

## Purpose

pnpm [public-hoist-pattern](https://pnpm.io/npmrc#public-hoist-pattern)
only affects to the top-project (virtual store), not the sub-projects,
as Nuxt layer, we do not want to copy deps/devDeps from here to there,
so we want to hoist the layer's deps to the project.

e.g. `common->@nuxt`, `mobile->common` but no `@nuxt`, after hoist layer,

```diff
├── common
│   ├── node_modules
│   │   ├── @nuxt -> ../.pnpm/...
└── mobile
    ├── node_modules
    │   ├── @fessional
    │   │   └── razor-common -> ../.pnpm/...
+   │   ├── @nuxt -> ../.pnpm/... // ✅ hoist as layer
```

## Usage

add the `layer` deps to the following fields in package.json

* `hoistLayer` - to hoist the deps of the layer
* `dependencies` or `devDependencies` - for the package manager
* do NOT use [`link:`](https://pnpm.io/cli/link) - do NOT hook
* do NOT indirect deps - `--resolution-only` do NOT resolve

the deps are resolved from tree top to bottom,
but hoist from tree bottom to top, it's a reverse process.

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

## Useful Commands

```bash
## install pkgs with DEBUG
DEBUG=1 pnpm i
## rebuild cached
pnpm i --resolution-only
## skip if error
pnpm i --ignore-pnpmfile --ignore-scripts

## for asdf manager
export PNPM_HOME="$(asdf where pnpm)/bin"
export PATH="$PNPM_HOME:$PATH"
pnpm -g add pnpm-hoist-layer
```

## Test and Diff

```bash
node -v #v20.16.0
pnpm -v #9.11.0

## pnpm via corepack
corepack enable pnpm
corepack use pnpm@latest

## test if success
pnpm test
# Test and Diff
# ✅ Success mono
# ✅ Success poly
```

### Mono before and after

diff `mono` from `pnpm -r i --ignore-pnpmfile` to `pnpm -r i` like this,

```diff
## pnpm -r list
Legend: production dependency, optional only, dev only
mono-test-0@1.0.0 pnpm-hoist-layer/test/mono/packages/pkg0
+ dependencies:
+   big-integer 1.6.52
= devDependencies:
+   dayjs 1.11.9
=   mono-test-1 link:../pkg1
+   mono-test-2 link:../pkg2
mono-test-1@1.0.0 pnpm-hoist-layer/test/mono/packages/pkg1
+ dependencies:
+   big-integer 1.6.52
= devDependencies:
+   dayjs 1.11.9
=   mono-test-2 link:../pkg2
mono-test-2@1.0.0 pnpm-hoist-layer/test/mono/packages/pkg2
= dependencies:
=   big-integer 1.6.52
= devDependencies:
=   dayjs 1.11.9

## tree -L 4
✅ mono
= ├── node_modules
= ├── package.json
= ├── packages
= │   ├── pkg0
= │   │   ├── node_modules
+ │   │   │   ├── big-integer -> ../../../node_modules/.pnpm/
+ │   │   │   ├── dayjs -> ../../../node_modules/.pnpm/
= │   │   │   ├── mono-test-1 -> ../../pkg1
+ │   │   │   └── mono-test-2 -> ../../pkg2
= │   │   └── package.json
= │   ├── pkg1
= │   │   ├── node_modules
+ │   │   │   ├── big-integer -> ../../../node_modules/.pnpm/
+ │   │   │   ├── dayjs -> ../../../node_modules/.pnpm/
= │   │   │   └── mono-test-2 -> ../../pkg2
= │   │   └── package.json
= │   └── pkg2
= │       ├── node_modules
= │       │   ├── big-integer -> ../../../node_modules/.pnpm/
= │       │   └── dayjs -> ../../../node_modules/.pnpm/
= │       └── package.json
= ├── pnpm-lock.yaml
= └── pnpm-workspace.yaml
```

### Poly before and after

diff `poly` from `pnpm -r i --ignore-pnpmfile` to `pnpm -r i` like this,

```diff
## pnpm -r list
Legend: production dependency, optional only, dev only
poly-test-0@1.0.0 pnpm-hoist-layer/test/poly/packages/pkg0
+ dependencies:
+   big-integer 1.6.52
= devDependencies:
+   dayjs 1.11.9
=   poly-test-1 file:../pkg1
+   poly-test-2 file:../pkg2
poly-test-1@1.0.0 pnpm-hoist-layer/test/poly/packages/pkg1
+ dependencies:
+   big-integer 1.6.52
= devDependencies:
+   dayjs 1.11.9
=   poly-test-2 file:../pkg2
poly-test-2@1.0.0 pnpm-hoist-layer/test/poly/packages/pkg2
= dependencies:
=   big-integer 1.6.52
= devDependencies:
=   dayjs 1.11.9

## tree -L 4
✅ poly
= ├── package.json
= ├── packages
= │   ├── pkg0
= │   │   ├── node_modules
+ │   │   │   ├── big-integer -> .pnpm/
+ │   │   │   ├── dayjs -> .pnpm/
= │   │   │   ├── poly-test-1 -> .pnpm/
+ │   │   │   └── poly-test-2 -> .pnpm/
= │   │   ├── package.json
= │   │   └── pnpm-lock.yaml
= │   ├── pkg1
= │   │   ├── node_modules
+ │   │   │   ├── big-integer -> .pnpm/
+ │   │   │   ├── dayjs -> .pnpm/
= │   │   │   └── poly-test-2 -> .pnpm/
= │   │   ├── package.json
= │   │   └── pnpm-lock.yaml
= │   └── pkg2
= │       ├── node_modules
= │       │   ├── big-integer -> .pnpm/
= │       │   └── dayjs -> .pnpm/
= │       ├── package.json
= │       └── pnpm-lock.yaml
= └── pnpm-lock.yaml
```
