const fs = require('fs');
const path = require('path');
const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
const localeData = {};
for (const file of files) {
  localeData[file.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
}

const en = localeData.en;
for (const lang of Object.keys(localeData)) {
  if (lang === 'en') continue;
  let missing = [];
  for (const sec in en) {
    for (const k in en[sec]) {
      if (!localeData[lang][sec] || localeData[lang][sec][k] === undefined) {
        missing.push(`${sec}.${k}`);
      }
    }
  }
  console.log(`${lang}: ${missing.length} keys missing compared to en.json`);
  if (missing.length > 0 && missing.length <= 25) {
    console.log(`   Missing: ${missing.join(', ')}`);
  }
}
