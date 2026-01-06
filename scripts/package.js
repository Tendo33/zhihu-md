/**
 * Package script for Chrome Web Store
 * Creates a zip file ready for upload
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PACKAGE_NAME = 'zhihu-md';

// Files and directories to include in the package
const INCLUDE_FILES = [
  'manifest.json',
  'popup',
  'options',
  'content',
  'background',
  'lib',
  'icons',
  'README.md'
];

// Files to exclude (patterns)
const EXCLUDE_PATTERNS = [
  '.DS_Store',
  'Thumbs.db',
  '*.map'
];

function cleanDist() {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function copyFiles(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    
    for (const file of files) {
      // Skip excluded files
      if (EXCLUDE_PATTERNS.some(pattern => {
        if (pattern.startsWith('*')) {
          return file.endsWith(pattern.slice(1));
        }
        return file === pattern;
      })) {
        continue;
      }
      
      copyFiles(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function getVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
  return manifest.version;
}

function createZip() {
  const version = getVersion();
  const zipName = `${PACKAGE_NAME}-v${version}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  const tempDir = path.join(DIST_DIR, PACKAGE_NAME);
  
  // Create temp directory with package contents
  fs.mkdirSync(tempDir, { recursive: true });
  
  for (const item of INCLUDE_FILES) {
    const src = path.join(ROOT_DIR, item);
    const dest = path.join(tempDir, item);
    
    if (fs.existsSync(src)) {
      copyFiles(src, dest);
      console.log(`  ✓ ${item}`);
    } else {
      console.log(`  ⚠ ${item} (not found, skipped)`);
    }
  }
  
  // Create zip using PowerShell (Windows) or zip command (Unix)
  const isWindows = process.platform === 'win32';
  
  try {
    if (isWindows) {
      // Use PowerShell Compress-Archive
      execSync(
        `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      // Use zip command
      execSync(`cd "${DIST_DIR}" && zip -r "${zipName}" "${PACKAGE_NAME}"`, { stdio: 'inherit' });
    }
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true });
    
    return { zipPath, zipName };
  } catch (error) {
    console.error('Error creating zip:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('\n📦 Packaging Zhihu-md for Chrome Web Store...\n');
  
  // Clean dist directory
  console.log('Cleaning dist directory...');
  cleanDist();
  
  // Copy and create zip
  console.log('\nCopying files:');
  const { zipPath, zipName } = createZip();
  
  // Get file size
  const stats = fs.statSync(zipPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  
  console.log('\n✅ Package created successfully!');
  console.log(`   File: dist/${zipName}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log('\n📤 Ready to upload to Chrome Web Store');
  console.log('   https://chrome.google.com/webstore/devconsole\n');
}

main();
