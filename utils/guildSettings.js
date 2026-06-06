const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.resolve(__dirname, '..', 'guild_settings.json');
let guildSettings = {};

try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    guildSettings = JSON.parse(raw || '{}');
  }
} catch (err) {
  console.error('Guild settings load error:', err);
}

function saveGuildSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(guildSettings, null, 2), 'utf8');
  } catch (err) {
    console.error('Guild settings save error:', err);
  }
}

module.exports = { guildSettings, saveGuildSettings };