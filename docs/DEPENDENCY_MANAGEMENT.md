# SaveIt App - Dependency Management Strategy

## Overview

This document outlines our approach to managing dependencies in SaveIt App to ensure stability, security, and maintainability.

## Why No `--legacy-peer-deps`

We **deliberately avoid** using `--legacy-peer-deps` because:

1. **Hides real problems**: It masks peer dependency conflicts that will cause runtime issues later
2. **Security risks**: Might allow incompatible versions that have known vulnerabilities
3. **Future maintenance burden**: Creates technical debt that compounds over time
4. **CI/CD complications**: Works locally but fails in strict CI environments

## Our Strategy

### 1. Strict Peer Dependency Resolution

All dependencies are explicitly compatible:
- Root `package.json`: Only core dev tools and monorepo config
- Service packages: Explicitly declare all peer dependencies
- Shared packages: Are dependencies, not peers

### 2. Dependency Policies

#### Version Constraints
```json
{
  "typescript": "^5.3.3",    // Minor updates allowed
  "express": "^4.18.2",      // Minor updates allowed
  "@types/node": "^20.11.5"  // Minor updates allowed
}
```

- **`^` (caret)**: Allow changes that don't modify the left-most non-zero digit
  - `^5.3.3` → allows `5.x.x` updates (5.4.0, 5.5.0, etc.)
  - `^0.2.3` → allows `0.2.x` updates only (0.2.4, 0.2.5, etc.)
  
- **`~` (tilde)**: Allow patch-level changes only
  - `~5.3.3` → allows `5.3.x` updates only (5.3.4, 5.3.5, etc.)

### 3. Monorepo Workspace Structure

```
package.json (root - minimal deps)
├── services/*
│   ├── reservation/package.json
│   ├── qr-code/package.json
│   └── ... (all services)
└── shared/*
    ├── types/package.json
    ├── database/package.json
    └── ... (all shared)
```

**Why this works**:
- Shared packages are installed once (workspace deduplication)
- Services don't conflict with each other
- Clear dependency graph

### 4. Peer Dependency Rules

#### What IS a Peer Dependency
- Shared framework/utility that multiple packages consume
- Typically in `shared/*` packages
- Example: `@saveit/types` is used by ALL services

#### What IS NOT a Peer Dependency
- Direct production dependencies
- Service-specific libraries
- Should use regular dependencies

### 5. NPM Configuration

File: `.npmrc`

```ini
save-exact=true                    # Install exact versions
strict-peer-dependencies=true      # Enforce compatibility
workspaces-update=true             # Update workspace packages together
prefer-workspace-packages=true     # Use local packages when available
```

## Installation Instructions

### Fresh Installation

```bash
# Clean slate - remove old locks
rm -rf node_modules package-lock.json

# Install with workspace resolution
npm install

# Verify
npm run build
```

**No `--legacy-peer-deps` needed!**

### Updating Dependencies

#### Safe Update (patch version)
```bash
npm update              # Updates within constraints (e.g., 5.3.3 → 5.3.5)
npm run build           # Verify compilation
npm run typecheck       # Check types
npm test                # Run tests
```

#### Feature Update (minor version)
```bash
npm install express@5.4.0      # Specific version
npm run build                   # Verify
npm test                        # Run tests
git commit -m "Update express to 5.4.0"
```

#### Breaking Update (major version)
```bash
# Only after:
# 1. Reading changelog
# 2. Testing thoroughly
# 3. Updating dependent code

npm install express@6.0.0
npm run build
npm run typecheck
npm test
# Review changes carefully
git commit -m "Upgrade express to v6 - BREAKING CHANGES: ..."
```

## Dependency Audit

### Check for Vulnerabilities
```bash
npm audit

# Fix known vulnerabilities
npm audit fix

# Force fix (may break things)
npm audit fix --force
```

### Check Outdated Packages
```bash
npm outdated

# Shows:
# Package    Current  Wanted  Latest  Location
# express    4.18.2   4.18.2  4.19.0  saveit-app
```

### Check Duplicates
```bash
npm ls --all | grep "deduped"

# Ideally shows: very few duplicates
```

## Workspace Package Dependencies

### Correct Way to Depend on Shared Packages

In `services/reservation/package.json`:
```json
{
  "dependencies": {
    "@saveit/types": "*",        // ✅ Use * for workspace packages
    "@saveit/database": "*",
    "express": "^4.18.2"         // ✅ Use ^ for external packages
  }
}
```

### Why `*` for Workspace Packages?

- Workspace packages are versioned together
- Always use the local version
- Avoids version mismatches
- Automatic updates via `npm version`

## Troubleshooting

### Issue: "peer dep missing"

**Cause**: A package requires another package as peer dependency

**Solution**:
```bash
# Check what's missing
npm ls

# Install the missing package
npm install missing-package

# Verify
npm run build
```

### Issue: "could not resolve dependency"

**Cause**: Version constraints are incompatible

**Solution**:
1. Check versions of conflicting packages
2. Update to compatible versions
3. If stuck, file an issue with specific versions
4. Never use `--legacy-peer-deps`

### Issue: Builds fail in CI but work locally

**Cause**: CI uses strict peer dependency checking

**Solution**:
1. Run CI locally: `npm ci`
2. Don't add `--legacy-peer-deps` to scripts
3. Fix actual conflicts instead
4. Test locally before pushing

## Best Practices

✅ **DO**:
- Keep dependencies minimal
- Use exact versions in `.npmrc`
- Review changelog before updating
- Test after any dependency change
- Use `npm ci` in CI/CD (not `npm install`)
- Document why specific versions are needed

❌ **DON'T**:
- Use `--legacy-peer-deps` as a solution
- Ignore npm warnings
- Update multiple major versions at once
- Commit dependency changes without testing
- Use overly loose version constraints (e.g., `*` for external packages)

## Maintenance Schedule

### Weekly
- Monitor security advisories
- Check for critical updates

### Monthly
- Review `npm audit`
- Update patch versions
- Test thoroughly

### Quarterly
- Evaluate minor/major updates
- Plan significant upgrades
- Document migration paths

## References

- [npm docs: peer dependencies](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#peerdependencies)
- [npm workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [Semantic versioning](https://semver.org/)
- [npm-check-updates tool](https://www.npmjs.com/package/npm-check-updates)

## Summary

By following this strategy, we ensure:
- ✅ Clean, reproducible builds
- ✅ Security through explicit versions
- ✅ Clear dependency graph
- ✅ Easy maintenance and upgrades
- ✅ Compatibility across CI/CD environments
- ✅ No hidden surprises or regressions
