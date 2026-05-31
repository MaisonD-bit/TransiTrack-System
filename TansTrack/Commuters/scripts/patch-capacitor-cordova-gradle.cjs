/**
 * Capacitor regenerates android/*.gradle on sync with older AGP / wrong paths.
 * Re-apply project standards to match TansTrack/transit.
 */
const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');

function patchCordovaPluginsGradle() {
  const target = path.join(androidDir, 'capacitor-cordova-android-plugins', 'build.gradle');
  if (!fs.existsSync(target)) {
    console.warn('patch: skip (missing)', target);
    return;
  }

  let text = fs.readFileSync(target, 'utf8');
  const before = text;

  text = text.replace(
    /classpath 'com\.android\.tools\.build:gradle:[^']+'/,
    "classpath 'com.android.tools.build:gradle:8.9.1'"
  );

  text = text.replace(
    /\s*flatDir\s*\{\s*dirs\s*'src\/main\/libs'\s*,\s*'libs'\s*\}\s*/,
    '\n'
  );

  if (text !== before) {
    fs.writeFileSync(target, text);
    console.log('Patched capacitor-cordova-android-plugins/build.gradle (AGP 8.9.1, removed flatDir).');
  }
}

function patchCapacitorSettingsGradle() {
  const target = path.join(androidDir, 'capacitor.settings.gradle');
  if (!fs.existsSync(target)) {
    return;
  }

  let text = fs.readFileSync(target, 'utf8');
  const before = text;

  // Use Commuters/node_modules (same as transit), not hoisted TansTrack/node_modules.
  text = text.replace(/\.\.\/\.\.\/node_modules/g, '../node_modules');

  if (text !== before) {
    fs.writeFileSync(target, text);
    console.log('Patched capacitor.settings.gradle (../node_modules paths).');
  }
}

patchCordovaPluginsGradle();
patchCapacitorSettingsGradle();
