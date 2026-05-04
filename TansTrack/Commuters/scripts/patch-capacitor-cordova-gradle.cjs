/**
 * Capacitor regenerates android/capacitor-cordova-android-plugins/build.gradle on sync
 * with AGP 8.7.2 + flatDir. Re-apply project standards (match root build.gradle).
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'android', 'capacitor-cordova-android-plugins', 'build.gradle');
if (!fs.existsSync(target)) {
  console.warn('patch-capacitor-cordova-gradle: skip (file missing)', target);
  process.exit(0);
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
} else {
  console.log('capacitor-cordova-android-plugins/build.gradle already patched or template changed.');
}
