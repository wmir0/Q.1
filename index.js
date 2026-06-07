require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const { guildSettings } = require('./utils/guildSettings');

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

console.log(`Token kaynağı: ${process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : process.env.BOT_TOKEN ? 'BOT_TOKEN' : null}`);
client.login(token);
