const fs = require('fs');
const path = require('path');

const LEVELS_FILE = path.resolve(__dirname, '..', 'levels.json');
const XP_PER_SENTENCE = 8;
const BASE_LEVEL_XP = 100;
const LEVEL_XP_GROWTH = 45;

const milestoneRoles = [
  { level: 5, name: 'Seviye 5', color: 0x2ECC71 },
  { level: 10, name: 'Seviye 10', color: 0x3498DB },
  { level: 20, name: 'Seviye 20', color: 0x9B59B6 },
  { level: 30, name: 'Seviye 30', color: 0xE67E22 },
  { level: 50, name: 'Seviye 50', color: 0xF1C40F }
];

let levels = {};

try {
  if (fs.existsSync(LEVELS_FILE)) {
    levels = JSON.parse(fs.readFileSync(LEVELS_FILE, 'utf8') || '{}');
  }
} catch (err) {
  console.error('Level data load error:', err);
}

function saveLevels() {
  try {
    fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2), 'utf8');
  } catch (err) {
    console.error('Level data save error:', err);
  }
}

function getLevelThreshold(level) {
  return BASE_LEVEL_XP + ((level - 1) * LEVEL_XP_GROWTH);
}

function countSentences(content) {
  const text = (content || '').trim();
  if (!text) return 1;

  const matches = text.match(/[.!?]+(?:\s|$)/g);
  return Math.max(1, matches ? matches.length : 1);
}

function ensureUser(guildId, userId) {
  levels[guildId] = levels[guildId] || {};
  levels[guildId][userId] = levels[guildId][userId] || { level: 1, xp: 0, totalXp: 0 };
  return levels[guildId][userId];
}

function addMessageXp(guildId, userId, content) {
  const userLevel = ensureUser(guildId, userId);
  const sentences = countSentences(content);
  const earned = sentences * XP_PER_SENTENCE;

  userLevel.xp += earned;
  userLevel.totalXp = (userLevel.totalXp || 0) + earned;

  let leveledUp = false;
  let nextThreshold = getLevelThreshold(userLevel.level);

  while (userLevel.xp >= nextThreshold) {
    userLevel.xp -= nextThreshold;
    userLevel.level += 1;
    leveledUp = true;
    nextThreshold = getLevelThreshold(userLevel.level);
  }

  saveLevels();

  return {
    leveledUp,
    earned,
    sentences,
    level: userLevel.level,
    currentXp: userLevel.xp,
    nextThreshold,
    remainingXp: nextThreshold - userLevel.xp
  };
}

function progressBar(currentXp, nextThreshold, size = 12) {
  const ratio = nextThreshold > 0 ? Math.min(currentXp / nextThreshold, 1) : 0;
  const filled = Math.round(ratio * size);
  return `${'#'.repeat(filled)}${'-'.repeat(size - filled)} ${Math.floor(ratio * 100)}%`;
}

function getMilestoneRoleDefinition(level) {
  return [...milestoneRoles].reverse().find(role => level >= role.level) || null;
}

function getMilestoneRoleNames() {
  return milestoneRoles.map(role => role.name);
}

module.exports = {
  addMessageXp,
  progressBar,
  getMilestoneRoleDefinition,
  getMilestoneRoleNames
};
