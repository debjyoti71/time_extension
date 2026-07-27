// Sync package version from git tags / CI environment
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageLockPath = path.join(repoRoot, 'package-lock.json');

function normalizeVersion(raw) {
  const value = String(raw || '').trim();
  if (!value) { return ''; }
  const withoutRef = value.replace(/^refs\/tags\//, '');
  return withoutRef.replace(/^v/, '');
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return normalizeVersion(pkg.version);
  } catch {
    return '';
  }
}

function resolveVersion() {
  const cliVersion = normalizeVersion(process.argv[2]);
  if (cliVersion) { return cliVersion; }

  const envVersion = normalizeVersion(process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || '');
  if (/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(envVersion)) {
    return envVersion;
  }

  try {
    const exactTag = execFileSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim();
    const normalized = normalizeVersion(exactTag);
    if (normalized) { return normalized; }
  } catch {
    // Fall through to the latest tag or the current package version.
  }

  try {
    const latestTag = execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim();
    const normalized = normalizeVersion(latestTag);
    if (normalized) { return normalized; }
  } catch {
    // Fall through to the current package version.
  }

  return readPackageVersion();
}

function updateVersionFile(filePath, version) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  parsed.version = version;
  if (parsed.packages && parsed.packages['']) {
    parsed.packages[''].version = version;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

const version = resolveVersion();
if (!version) {
  throw new Error('Unable to resolve a package version from git or package.json');
}

updateVersionFile(packageJsonPath, version);
updateVersionFile(packageLockPath, version);

process.stdout.write(version);
