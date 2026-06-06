const fs = require('fs');
const path = require('path');

const LEVELS_FILE = path.resolve(__dirname, '..', 'levels.json');
let levelData = {};

try {
  if (fs.existsSync(LEVELS_FILE)) {
    const raw = fs.readFileSync(LEVELS_FILE, 'utf8');
    levelData = JSON.parse(raw || '{}');
  }
} catch (err) {
  console.error('Level data load error:', err);
}

function saveLevelData() {
  try {
    fs.writeFileSync(LEVELS_FILE, JSON.stringify(levelData, null, 2), 'utf8');
  } catch (err) {
    console.error('Level data save error:', err);
  }
}

function xpForLevel(level) {
  return 50 * level * level + 50 * level;
}

function getCurrentLevel(totalXp) {
  let level = 1;
  while (totalXp >= xpForLevel(level)) {
    level += 1;
  }
  return level;
}

function getLevelData(guildId, userId) {
  levelData[guildId] = levelData[guildId] || {};
  levelData[guildId][userId] = levelData[guildId][userId] || { xp: 0, messages: 0 };

  const user = levelData[guildId][userId];
  const level = getCurrentLevel(user.xp);
  const previousThreshold = xpForLevel(level - 1);
  const currentXp = user.xp - previousThreshold;
  const nextThreshold = xpForLevel(level) - previousThreshold;

  return {
    totalXp: user.xp,
    level,
    messages: user.messages,
    currentXp,
    nextThreshold,
    remainingXp: nextThreshold - currentXp
  };
}

function progressBar(current, total, size = 16) {
  const progress = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(progress * size);
  const empty = size - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.round(progress * 100)}%`;
}

const LEVEL_ROLE_DEFINITIONS = {
  20: { name: 'Seviye 20', color: 0x1ABC9C },
  40: { name: 'Seviye 40', color: 0x2ECC71 },
  60: { name: 'Seviye 60', color: 0x3498DB },
  90: { name: 'Seviye 90', color: 0x9B59B6 },
  120: { name: 'Seviye 120', color: 0xE67E22 },
  160: { name: 'Seviye 160', color: 0xE74C3C },
  200: { name: 'Seviye 200', color: 0xF1C40F }
};

function getMilestoneRoleDefinition(level) {
  return LEVEL_ROLE_DEFINITIONS[level] || null;
}

function getMilestoneRoleNames() {
  return Object.values(LEVEL_ROLE_DEFINITIONS).map(def => def.name);
}

function addMessageXp(guildId, userId, messageContent) {
  const trimmed = messageContent?.trim();
  if (!trimmed || trimmed.length < 5) return null;

  const earned = Math.min(25, Math.max(5, Math.floor(trimmed.length / 10) + 5));
  const user = getLevelData(guildId, userId);
  const previousLevel = user.level;

  levelData[guildId][userId].xp += earned;
  levelData[guildId][userId].messages += 1;
  saveLevelData();

  const updated = getLevelData(guildId, userId);
  const leveledUp = updated.level > previousLevel;

  return {
    ...updated,
    earned,
    leveledUp
  };
}

module.exports = { addMessageXp, getLevelData, progressBar, xpForLevel, getMilestoneRoleDefinition, getMilestoneRoleNames };
