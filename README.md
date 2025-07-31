# 🪝 pnpm-hoist-layer

use `.pnpmfile.cjs` to hoist deps/devDeps to project like
[Nuxt Layer](https://nuxt.com/docs/getting-started/layers)

✅ 10.x, 9.12+ Downloads(7-Days > 500K)

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

## How it Works

When using `catalog` in `pnpm-workspace.yaml`, it is not easy to manage
the dependencies via `pnpm add`, the recommended practice is to manually
edit the `catalog` and the `package.json`, and then run `pnpm i` to
install the update, at this point, the following happens to pnpm-hoist-layer.

* make a temporary directory(tmpDir), and write the `.pnpmfile.cjs` hook.
* start the sub-process, `pnpm -r i --resolution-only --lockfile-dir=tmpDir`
* sub-process quickly resolves packages related to hoistLayer
* top-process parse stdout of sub-process as hoistLayer metadata
* top-process merges hoistLayer metadata via hooks

the hoistLayer metadata is `📝 hoist-layer.json` in the console,

```json
[
  {
    "name": "hoist1",
    "dependencies": {
      "date-fns": "catalog:h1",
      "lodash-es": "catalog:h1"
    },
    "devDependencies": {}
  },
  {
    "name": "hoist2",
    "dependencies": {
      "date-fns": "catalog:h2",
      "hoist1": "workspace:*",
      "lodash-es": "catalog:h1"
    },
    "devDependencies": {},
    "hoistLayer": [
      "hoist1"
    ]
  }
]
```

## Usage

(1) add `hoistLayer` to the `package.json`

* `*dependencies` - for package resolution
* `hoistLayer` - to define the layer package, if the item is
  - string - include it and all its dependencies
  - array - include it(`[0]`) but exclude the dependencies(`[1...]`)
* ⚠️ In complex layered repos, exclude rules may introduce bug and bad isolation.

```diff
  "devDependencies": {
+   "@fessional/razor": "0.1.0",
+   "@fessional/razor-common": "file:../common",
  },
+ "hoistLayer": [
+   [ "@fessional/razor", "semver" ],
+   "@fessional/razor-common",
+ ]
```

(2) write `.pnpmfile.cjs` as pnpm hook

```bash
## 💾 opt-1: project install and require
pnpm add -D pnpm-hoist-layer
cat > .pnpmfile.cjs << 'EOF'
const pnpmfile = {};
try {
  const hoist = require('pnpm-hoist-layer');
  pnpmfile.hooks = hoist.hooks;
  console.info('✅ pnpm-hoist-layer is', hoist.version);
} catch {
  console.warn('⚠️ pnpm-hoist-layer not found, reinstall to enable layer hoisting.');
}
module.exports = pnpmfile;
EOF

## 📦 opt-2: write the content to .pnpmfile.cjs
curl -o .pnpmfile.cjs https://raw.githubusercontent.com/trydofor\
/pnpm-hoist-layer/main/index.js
```
## Known Issues

the deps tree are resolved from top to bottom, and hoist from bottom to top, it's a reverse process.

* ✅ shared-workspace-lockfile=false, may 🐞 [peers](https://github.com/pnpm/pnpm/issues/8538)
* ✅ monorepo + shared-workspace-lockfile=false, but 🐞 [default=true](https://github.com/vuejs/language-tools/issues/4860)
* ✅ pnpm cli at top-dir, but 🐞 sub-dir (`packages/*`)
* ✅ `--resolution-only` resolve `devDependencies`, but ❗ `pnpm i` NOT.
* ❗ do NOT use [`link:`](https://pnpm.io/cli/link), it do NOT hook
* ❗ do NOT deps indirectly , 2+ level deps NOT resolved
* ❗ this is a [bad practice](https://github.com/pnpm/pnpm/issues/8588)

## Node and Pnpm

manages `nodejs` version by [asdf](https://asdf-vm.com)
and `pnpm` by [corepack](https://nodejs.org/api/corepack.html)

```bash
git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.15.0
## config zsh
cat >> ~/.zshrc << 'EOF'
export ASDF_NODEJS_AUTO_ENABLE_COREPACK=true
export ASDF_NODEJS_LEGACY_FILE_DYNAMIC_STRATEGY=latest_installed
source "$HOME/.asdf/asdf.sh"
EOF
## support .nvmrc or .node-version
cat >> ~/.asdfrc << 'EOF'
legacy_version_file=yes
EOF

## install nodejs plugin
asdf plugin add nodejs
## install nodejs and corepack enable
asdf install nodejs
## by package.json and corepack
pnpm -v
## Corepack is about to download

## init workspace top-project first
pnpm -w i --ignore-pnpmfile
## init workspace sub-project
pnpm -r i
## to debug with env DEBUG != null
DEBUG=1 pnpm i
## ignore if error
pnpm i --ignore-pnpmfile --ignore-scripts
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
# ✅ Success hoist, npmrc={}
```

* hoist - hoist auto/manual testing
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
