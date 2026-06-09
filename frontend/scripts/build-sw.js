const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../public/sw.js');
const appManifestPath = path.join(__dirname, '../.next/app-build-manifest.json');
const pageManifestPath = path.join(__dirname, '../.next/build-manifest.json');

const baseAssets = [
  '/',
  '/offline.html',
  '/faqs',
  '/questions',
  '/guidelines',
  '/notifications',
  '/saved',
  '/search',
  '/tags',
  '/users',
  '/logo.png',
  '/pwa/icons/icon-72x72.png',
  '/pwa/icons/icon-96x96.png',
  '/pwa/icons/icon-128x128.png',
  '/pwa/icons/icon-144x144.png',
  '/pwa/icons/icon-152x152.png',
  '/pwa/icons/icon-192x192.png',
  '/pwa/icons/icon-384x384.png',
  '/pwa/icons/icon-512x512.png',
  '/favicon.ico',
  '/icon.png',
  '/api/faqs?limit=100',
  '/api/questions?page=1&sort=newest',
  '/api/questions?page=1&sort=active',
  '/api/questions?page=1&sort=votes',
  '/api/questions?page=1&sort=liked',
  '/api/questions?page=1&sort=views',
  '/api/recommendations/recommended?page=1&limit=20'
];

const assets = new Set(baseAssets);

// Helper to add files from manifest
function addFromManifest(manifestPath) {
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.pages) {
      Object.values(manifest.pages).forEach(files => {
        files.forEach(file => {
          if (file.endsWith('.js') || file.endsWith('.css')) {
            assets.add('/_next/' + file);
          }
        });
      });
    }
    if (manifest.polyfillFiles) {
      manifest.polyfillFiles.forEach(file => {
        assets.add('/_next/' + file);
      });
    }
    if (manifest.rootMainFiles) {
      manifest.rootMainFiles.forEach(file => {
        assets.add('/_next/' + file);
      });
    }
  }
}

addFromManifest(appManifestPath);
addFromManifest(pageManifestPath);

const assetsArray = Array.from(assets);
console.log(`[Build SW] Found ${assetsArray.length} assets to cache.`);

let swContent = fs.readFileSync(swPath, 'utf8');

// Increment Cache Names with a unique build timestamp to force PWA cache update on build
const buildTimestamp = Date.now();
swContent = swContent.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = 'prashnasarathi-pwa-cache-${buildTimestamp}';`);
swContent = swContent.replace(/const DATA_CACHE_NAME = '[^']+';/, `const DATA_CACHE_NAME = 'prashnasarathi-data-cache-${buildTimestamp}';`);

// Replace STATIC_ASSETS array definition
const startMarker = 'const STATIC_ASSETS = [';
const endMarker = '];';

const startIndex = swContent.indexOf(startMarker);
if (startIndex !== -1) {
  const endIndex = swContent.indexOf(endMarker, startIndex);
  if (endIndex !== -1) {
    const replacement = `const STATIC_ASSETS = ${JSON.stringify(assetsArray, null, 2)};`;
    swContent = swContent.substring(0, startIndex) + replacement + swContent.substring(endIndex + endMarker.length);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`[Build SW] public/sw.js updated successfully (Cache Version: ${buildTimestamp}).`);
  } else {
    console.error('[Build SW] Could not find end marker in sw.js');
  }
} else {
  console.error('[Build SW] Could not find start marker in sw.js');
}
