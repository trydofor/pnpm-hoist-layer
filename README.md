# pnpm-hoist-layer

use `.pnpmfile.cjs` to hoist deps to monorepo like nuxt layer

## Purpose

pnpm public hoist only affect to the root project, but not to the sub project,
as Nuxt layer, we do not want to copy deps/devDeps from here to there,
so we need to hoist layer's deps to the project.

### before - no nuxt deps in mobile

```tree
├── common
│   ├── node_modules
│   │   ├── @nuxt
└── mobile
    ├── node_modules
    │   ├── @fessional
    │   │   └── razor-common -> ../../../common
```

### after - hoist nuxt from common

```tree
├── common
│   ├── node_modules
│   │   ├── @nuxt
└── mobile
    ├── node_modules
    │   ├── @fessional
    │   │   └── razor-common -> ../../../common
    │   ├── @nuxt // ✅ hoist from razor-common
```

## Usage

add `hoistLayer` to package.json

```diff
  "devDependencies": {
+   "@fessional/razor-common": "file:../common",
  },
+ "hoistLayer": [
+   "@fessional/razor-common",
+ ]
```

hook and hoist deps

```bash
## option 1: install and require in global
pnpm add -g pnpm-hoist-layer
cat > .pnpmfile.cjs << 'EOF'
const { hooks } = require('pnpm-hoist-layer')
module.exports = {
  hooks,
}
EOF

## option 2: write this to .pnpmfile.cjs
curl -o .pnpmfile.cjs https://raw.githubusercontent.com/trydofor/pnpm-hoist-layer/main/index.js
```

useful commands

```bash
## install pkgs
pnpm install

## rebuild cached
pnpm i --resolution-only

## skip if error
pnpm i --ignore-pnpmfile --ignore-scripts
```

## License

MIT
