import { execSync } from 'child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BACKEND = join(ROOT, 'backend');
const FRONTEND = join(ROOT, 'frontend');
const DIST = join(ROOT, 'dist');
const BUILD = join(DIST, '_build');

function shell(cmd, opts = {}) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// Step 0: Clean
console.log('\n=== Cleaning ===');
if (existsSync(BUILD)) rmSync(BUILD, { recursive: true });
ensureDir(BUILD);
if (!existsSync(DIST)) mkdirSync(DIST);

// Step 1: Build frontend
console.log('\n=== Building frontend ===');
shell('npx vite build --outDir="' + join(BACKEND, 'public') + '" --emptyOutDir', { cwd: FRONTEND });

// Step 2: Bundle backend
console.log('\n=== Bundling backend ===');
shell('npx esbuild sea-entry.js --bundle --platform=node --format=cjs --outfile="' + join(BUILD, 'sea-bundle.js') + '"', { cwd: BACKEND });

const bundlePath = join(BUILD, 'sea-bundle.js');
const bundleSize = (statSync(bundlePath).size / 1024).toFixed(1);
console.log('  Bundle size: ' + bundleSize + ' KB');

// Step 3: Create SEA config
console.log('\n=== Creating SEA config ===');
const seaConfig = {
  main: bundlePath.replace(/\\/g, '/'),
  output: join(BUILD, 'sea-blob.blob').replace(/\\/g, '/'),
  disableExperimentalSEAWarning: true,
};
writeFileSync(join(BUILD, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));

// Step 4: Generate SEA blob
console.log('\n=== Generating SEA blob ===');
shell('node --experimental-sea-config "' + join(BUILD, 'sea-config.json') + '"', { cwd: BUILD });

// Step 5: Create executable
console.log('\n=== Creating executable ===');
const outputExe = join(DIST, 'ClassroomBatteryManager.exe');
copyFileSync(process.execPath, outputExe);

// Step 6: Inject blob
console.log('\n=== Injecting SEA blob ===');
shell('npx postject "' + outputExe + '" NODE_SEA_BLOB "' + join(BUILD, 'sea-blob.blob') + '" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2');

// Step 7: Copy native module
console.log('\n=== Copying native module ===');
const nativeSource = join(BACKEND, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
if (existsSync(nativeSource)) {
  copyFileSync(nativeSource, join(DIST, 'better_sqlite3.node'));
  console.log('  Copied better_sqlite3.node');
} else {
  console.error('  WARNING: Native module not found!');
}

// Step 8: Copy frontend
console.log('\n=== Copying frontend assets ===');
const publicDir = join(BACKEND, 'public');
const distPublic = join(DIST, 'public');
if (existsSync(publicDir)) {
  if (existsSync(distPublic)) rmSync(distPublic, { recursive: true });
  cpSync(publicDir, distPublic, { recursive: true });
  console.log('  Copied frontend assets');
}

// Step 9: Cleanup
console.log('\n=== Cleaning up ===');
rmSync(BUILD, { recursive: true });

// Summary
console.log('\n=== Build Complete ===');
const exeMB = (statSync(outputExe).size / 1024 / 1024).toFixed(1);
const nativeMB = (existsSync(join(DIST, 'better_sqlite3.node')) ? statSync(join(DIST, 'better_sqlite3.node')).size / 1024 / 1024 : 0).toFixed(1);
console.log(`  ClassroomBatteryManager.exe  ${exeMB} MB`);
console.log(`  better_sqlite3.node          ${nativeMB} MB`);
console.log(`  public/                      frontend assets`);
console.log(`  Total: ${(parseFloat(exeMB) + parseFloat(nativeMB)).toFixed(1)} MB`);
console.log(`\n  Run: dist\\ClassroomBatteryManager.exe`);
