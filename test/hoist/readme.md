# pnpm i twice

diff the 1st and 2nd installation.

* should no lockfile change
* should see `Lockfile is up to date`
* should be faster without resolution

```diff
pnpm i --ignore-pnpmfile
Scope: all 3 workspace projects
-Progress: resolved 689, reused 613, downloaded 0, added 613, done
-Done in 42.4s
+Lockfile is up to date, resolution step is skipped
+Already up to date
+Done in 5.6s
```

## with hoist

```bash
cd test/hoist
## 1st install
pnpm i
## 2nd install
pnpm i
```

## without hoist

```bash
cd test/hoist
## 1st install
pnpm i --ignore-pnpmfile
## 2nd install
pnpm i --ignore-pnpmfile

## 1st resolve change lock-file
pnpm i --resolution-only --ignore-pnpmfile
```

## resolution

```bash
cd test/hoist

## 1st resolve change lock-file
pnpm i --resolution-only --ignore-pnpmfile
```
