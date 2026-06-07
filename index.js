require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const { guildSettings } = require('./utils/guildSettings');

const LOCK_FILE = path.join(__dirname, '.bot.lock');

function createSingleInstanceLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const ageMs = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
      if (ageMs < 6 * 60 * 60 * 1000) {
        console.error('Bot zaten bu klasorden calisiyor gibi gorunuyor. Once eski terminalde Ctrl+C yap.');
        process.exit(1);
      }
      fs.rmSync(LOCK_FILE, { force: true });
    }

    fs.writeFileSync(LOCK_FILE, `${process.pid}`, { flag: 'wx' });

    const cleanup = () => fs.rmSync(LOCK_FILE, { force: true });
    process.once('exit', cleanup);
    process.once('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.once('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
  } catch (err) {
    console.error('Bot kilidi olusturulamadi:', err.message);
    process.exit(1);
  }
}

createSingleInstanceLock();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (!command?.data || !command?.execute) continue;
  client.commands.set(command.data.name, command);
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.on('error', error => {
  console.error('Client error:', error);
});

client.on('shardError', error => {
  console.error('Shard error:', error);
});

const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
if (!token) {
  console.error('HATA: DISCORD_TOKEN veya BOT_TOKEN ortam değişkeni ayarlı değil.');
  process.exit(1);
}

console.log(`Bot klasoru: ${__dirname}`);
console.log(`Calisan islem ID: ${process.pid}`);
console.log(`Token kaynağı: ${process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : process.env.BOT_TOKEN ? 'BOT_TOKEN' : null}`);
client.login(token);
