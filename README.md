# 🪝 pnpm-hoist-layer

use `.pnpmfile.cjs` to hoist deps/devDeps to project like
[Nuxt Layer](https://nuxt.com/docs/getting-started/layers)

## Purpose

pnpm [public-hoist-pattern](https://pnpm.io/npmrc#public-hoist-pattern)
only affects to the top-project (virtual store), not the sub-projects, therefore,

* relative path issues may occur
* copy same deps/devDeps from here to there
* config too many hoist-pattern

how to auto add the dep's deps/devDeps to my project?
i.e. give your deps/devDeps to me when i deps on you.

e.g. `mobile->common`, `common->@nuxt`, after hoist layer,

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

(1) add `layer` to the package.json

* `hoistLayer` - to define which is the layer
* `*dependencies` - for package resolution

```diff
  "devDependencies": {
+   "@fessional/razor-common": "file:../common",
  },
+ "hoistLayer": [
+   "@fessional/razor-common",
+ ]
```

(2) write `.pnpmfile.cjs` to hook

```bash
## 💾 opt-1: project install and require
pnpm add -D pnpm-hoist-layer
cat > .pnpmfile.cjs << 'EOF'
module.exports = require('pnpm-hoist-layer');
EOF

## 📦 opt-2: write content to .pnpmfile.cjs
curl -o .pnpmfile.cjs https://raw.githubusercontent.com/trydofor\
/pnpm-hoist-layer/main/index.js

## 🏠 opt-3: global install and require
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
```

## Known Issues

the deps tree are resolved from top to bottom, and hoist from bottom to top, it's a reverse process.

* ✅ shared-workspace-lockfile=false, may 🐞 [peers](https://github.com/pnpm/pnpm/issues/8538)
* ✅ monorepo + shared-workspace-lockfile=false, but 🐞 [default=true](https://github.com/vuejs/language-tools/issues/4860)
* ✅ pnpm cli at top-dir, but 🐞 sub-dir (`packages/*`)
* ✅ for CI keep `hoist-layer.json`, or 🐞 LOCKFILE ERROR
* ✅ `hoistLayer` + `*Dependencies`, or 🐞 [Missing order](https://github.com/trydofor/pnpm-hoist-layer/issues/2)
* ✅ `--resolution-only` resolve `devDependencies`, but ❗ `pnpm i` NOT.
* ❗ do NOT use [`link:`](https://pnpm.io/cli/link), it do NOT hook
* ❗ do NOT deps indirectly , 2+ level deps NOT resolved
* ❗ this is a [bad practice](https://github.com/pnpm/pnpm/issues/8588)

## Useful Commands

```bash
## init workspace top-project first
pnpm -w i --ignore-pnpmfile
## init workspace sub-project
pnpm -r i
## to debug with env DEBUG != null
DEBUG=1 pnpm i
## ignore if error
pnpm i --ignore-pnpmfile --ignore-scripts

## asdf nodejs+pnpm, should disable corepack
export PNPM_HOME="$(asdf where pnpm)"
pnpm -g add pnpm-hoist-layer

## only corepack
corepack enable pnpm
corepack use pnpm@latest
```

## Test and Diff

```tree
Glossary
├── multi pkg, one git (often called "monorepo")
│   ├── with workspace (termed as "mono")
│   └── without workspace (termed as "poly")
└── one pkg, one git (termed as "solo")
```

```bash
node -v #v20.16.0
pnpm -v #9.12.1

pnpm test
# ✅ Success mono1, npmrc={}
# ✅ Success mono1, npmrc={"shared-workspace-lockfile":false}
# ✅ Success mono2, npmrc={}
# ✅ Success mono2, npmrc={"shared-workspace-lockfile":false}
# ✅ Success poly1, npmrc={}
# ✅ Success poly2, npmrc={}
```

* mono1 - multi-pkg + workspace, sub `hoistLayer`
* mono2 - multi-pkg + workspace, top `hoistLayer`
* poly1 - multi-pkg, sub `hoistLayer`
* poly2 - multi-pkg, top `hoistLayer`
* solo - single pkg as deps for test

### Mono before and after

diff `mono` from `pnpm -r i --ignore-pnpmfile` to `pnpm -r i` like this,

```diff
## pnpm -r list
Legend: production dependency, optional only, dev only
mono-test-0@1.0.0 pnpm-hoist-layer/test/mono/packages/pkg0
+ dependencies:
+   solo-prd-dep link:../../solo/prd
= devDependencies:
=   mono-test-1 link:../pkg1
+   mono-test-2 link:../pkg2
+   solo-dev-dep link:../../solo/dev
mono-test-1@1.0.0 pnpm-hoist-layer/test/mono/packages/pkg1
+ dependencies:
+   solo-prd-dep link:../../solo/prd
= devDependencies:
=   mono-test-2 link:../pkg2
+   solo-dev-dep link:../../solo/dev
mono-test-2@1.0.0 pnpm-hoist-layer/test/mono/packages/pkg2
= dependencies:
=   solo-prd-dep link:../../solo/prd
= devDependencies:
=   solo-dev-dep link:../../solo/dev

## tree -L 4
✅ mono
= ├── node_modules
= ├── package.json
= ├── packages
= │   ├── pkg0
= │   │   ├── node_modules
= │   │   │   ├── mono-test-1 -> ../../../node_modules/.pnpm/
+ │   │   │   └── mono-test-2 -> ../../pkg2
+ │   │   │   ├── solo-dev-dep -> ../../../solo/dev
+ │   │   │   ├── solo-prd-dep -> ../../../solo/prd
= │   │   └── package.json
= │   ├── pkg1
= │   │   ├── node_modules
= │   │   │   └── mono-test-2 -> ../../pkg2
+ │   │   │   ├── solo-dev-dep -> ../../../solo/dev
+ │   │   │   ├── solo-prd-dep -> ../../../solo/prd
= │   │   └── package.json
= │   └── pkg2
= │       ├── node_modules
= │       │   └── solo-dev-dep -> ../../../solo/dev
= │       │   ├── solo-prd-dep -> ../../../solo/prd
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
+   solo-prd-dep link:../../solo/prd
= devDependencies:
=   poly-test-1 file:../pkg1
+   poly-test-2 file:../pkg2
+   solo-dev-dep link:../../solo/dev
poly-test-1@1.0.0 pnpm-hoist-layer/test/poly/packages/pkg1
+ dependencies:
+   solo-prd-dep link:../../solo/prd
= devDependencies:
=   poly-test-2 file:../pkg2
+   solo-dev-dep link:../../solo/dev
poly-test-2@1.0.0 pnpm-hoist-layer/test/poly/packages/pkg2
= dependencies:
=   solo-prd-dep link:../../solo/prd
= devDependencies:
=   solo-dev-dep link:../../solo/dev

## tree -L 4
✅ poly
= ├── package.json
= ├── packages
= │   ├── pkg0
= │   │   ├── node_modules
= │   │   │   ├── poly-test-1 -> .pnpm/
+ │   │   │   └── poly-test-2 -> .pnpm/
+ │   │   │   ├── solo-dev-dep -> ../../../solo/dev
+ │   │   │   ├── solo-prd-dep -> ../../../solo/prd
= │   │   ├── package.json
= │   │   └── pnpm-lock.yaml
= │   ├── pkg1
= │   │   ├── node_modules
= │   │   │   └── poly-test-2 -> .pnpm/
+ │   │   │   ├── solo-dev-dep -> ../../../solo/dev
+ │   │   │   ├── solo-prd-dep -> ../../../solo/prd
= │   │   ├── package.json
= │   │   └── pnpm-lock.yaml
= │   └── pkg2
= │       ├── node_modules
= │       │   ├── solo-dev-dep -> ../../../solo/dev
= │       │   └── solo-prd-dep -> ../../../solo/prd
= │       ├── package.json
= │       └── pnpm-lock.yaml
= └── pnpm-lock.yaml
```
