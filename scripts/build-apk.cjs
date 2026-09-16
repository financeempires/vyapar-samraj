const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')
const apiDir = path.join(rootDir, 'src', 'app', 'api')
const tempApiDir = path.join(rootDir, 'src', '_api_temp_backup')
const nextDir = path.join(rootDir, '.next')
const outDir = path.join(rootDir, 'out')
const androidAssetsPublic = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public')

console.log('====================================================')
console.log(' [build-apk] Preparing Standalone Android APK Build')
console.log('====================================================')

// 1. Clean previous build caches
if (fs.existsSync(nextDir)) {
  console.log('[build-apk] Cleaning .next cache directory...')
  fs.rmSync(nextDir, { recursive: true, force: true })
}
if (fs.existsSync(outDir)) {
  console.log('[build-apk] Cleaning out/ directory...')
  fs.rmSync(outDir, { recursive: true, force: true })
}
if (fs.existsSync(androidAssetsPublic)) {
  console.log('[build-apk] Cleaning stale Android public assets...')
  fs.rmSync(androidAssetsPublic, { recursive: true, force: true })
}

let moved = false
try {
  if (fs.existsSync(apiDir)) {
    console.log('[build-apk] Temporarily moving src/app/api to src/_api_temp_backup for static export...')
    fs.renameSync(apiDir, tempApiDir)
    moved = true
  }

  console.log('[build-apk] Running Next.js static build...')
  execSync('npx.cmd next build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_BACKEND_URL: 'https://vyapar-samraj.onrender.com',
    },
  })

  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    throw new Error('[build-apk] Verification failed: out/index.html was not generated!')
  }

  console.log('[build-apk] Static export generated successfully in out/ directory!')
} finally {
  if (moved && fs.existsSync(tempApiDir)) {
    console.log('[build-apk] Restoring src/app/api from src/_api_temp_backup...')
    fs.renameSync(tempApiDir, apiDir)
    console.log('[build-apk] Restored src/app/api.')
  }
}

console.log('[build-apk] Synchronizing assets to Capacitor Android project...')
execSync('npx.cmd cap sync android', {
  cwd: rootDir,
  stdio: 'inherit',
})

const androidIndexHtml = path.join(androidAssetsPublic, 'index.html')
if (!fs.existsSync(androidIndexHtml)) {
  throw new Error('[build-apk] Verification failed: android/app/src/main/assets/public/index.html is missing!')
}

console.log('====================================================')
console.log(' [build-apk] SUCCESS: Android assets synced!')
console.log(' Next: Run Gradle assembleDebug to produce the APK.')
console.log('====================================================')
