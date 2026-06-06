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
  levelData[guildId][userId] = levelData[guildId][userId] || { xp: 0, sentences: 0, messages: 0 };

  const user = levelData[guildId][userId];
  const sentenceCount = user.sentences ?? user.messages ?? 0;
  const level = getCurrentLevel(user.xp);
  const previousThreshold = xpForLevel(level - 1);
  const currentXp = user.xp - previousThreshold;
  const nextThreshold = xpForLevel(level) - previousThreshold;

  return {
    totalXp: user.xp,
    level,
    sentences: sentenceCount,
    messages: sentenceCount,
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

function getSentenceTexts(messageContent) {
  const trimmed = messageContent.trim();
  if (!trimmed) return [];
  const sentences = trimmed
    .split(/(?:[.!?]+|[\r\n]+)\s*/)
    .map(str => str.trim())
    .filter(Boolean);
  return sentences.length ? sentences : [trimmed];
}

function xpForSentence(sentence) {
  const value = Math.max(5, Math.floor(sentence.length / 15) + 5);
  return Math.min(15, value);
}

function addMessageXp(guildId, userId, messageContent) {
  const trimmed = messageContent?.trim();
  if (!trimmed || trimmed.length < 5) return null;

  const sentenceTexts = getSentenceTexts(trimmed);
  const sentenceCount = sentenceTexts.length;
  const earned = Math.min(45, sentenceTexts.reduce((sum, sentence) => sum + xpForSentence(sentence), 0));

  const user = getLevelData(guildId, userId);
  const previousLevel = user.level;

  levelData[guildId][userId].xp += earned;
  levelData[guildId][userId].sentences = (levelData[guildId][userId].sentences ?? levelData[guildId][userId].messages ?? 0) + sentenceCount;
  levelData[guildId][userId].messages = levelData[guildId][userId].sentences;
  saveLevelData();

  const updated = getLevelData(guildId, userId);
  const leveledUp = updated.level > previousLevel;

  return {
    ...updated,
    earned,
    sentences: sentenceCount,
    leveledUp
  };
}

function getLeaderboard(guildId, limit = 10) {
  const guildLevelData = levelData[guildId] || {};
  return Object.entries(guildLevelData)
    .map(([userId, user]) => {
      const totalXp = user.xp || 0;
      return {
        userId,
        totalXp,
        level: getCurrentLevel(totalXp),
        sentences: user.sentences ?? user.messages ?? 0
      };
    })
    .sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      return b.sentences - a.sentences;
    })
    .slice(0, limit);
}

module.exports = {
  addMessageXp,
  getLevelData,
  getLeaderboard,
  progressBar,
  xpForLevel,
  getMilestoneRoleDefinition,
  getMilestoneRoleNames
};
