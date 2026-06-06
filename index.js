require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, PermissionsBitField, MessageFlags, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const recentMessageIds = new Set();
const recentVoiceCommands = new Set();
const processingVoiceCommands = new Set();
const DM_ANNOUNCEMENT_DELAY_MS = 5000;

const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const tokenSource = process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : process.env.BOT_TOKEN ? 'BOT_TOKEN' : null;
if (!token) {
  console.error('HATA: DISCORD_TOKEN veya BOT_TOKEN ortam değişkeni ayarlı değil.');
  process.exit(1);
}

console.log(`Token kaynağı: ${tokenSource}`);

const slashCommands = [
  {
    name: 'dmduyuru',
    description: 'Tüm sunucu üyelerine DM olarak duyuru gönderir',
    defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
    dmPermission: false,
    options: [
      {
        name: 'mesaj',
        type: 3,
        description: 'Gönderilecek duyuru metni',
        required: true
      }
    ]
  },
  {
    name: 'ping',
    description: 'Botun gecikmesini gösterir',
    dmPermission: false
  },
  {
    name: 'ban',
    description: 'Belirtilen kullanıcıyı sunucudan yasakla',
    defaultMemberPermissions: PermissionsBitField.Flags.BanMembers,
    dmPermission: false,
    options: [
      {
        name: 'hedef',
        type: 6,
        description: 'Yasaklanacak kullanıcı',
        required: true
      },
      {
        name: 'sebep',
        type: 3,
        description: 'Yasağın sebebi',
        required: false
      }
    ]
  },
  {
    name: 'kick',
    description: 'Belirtilen kullanıcıyı sunucudan at',
    defaultMemberPermissions: PermissionsBitField.Flags.KickMembers,
    dmPermission: false,
    options: [
      {
        name: 'hedef',
        type: 6,
        description: 'Atılacak kullanıcı',
        required: true
      },
      {
        name: 'sebep',
        type: 3,
        description: 'Atılma sebebi',
        required: false
      }
    ]
  },
  {
    name: 'mute',
    description: 'Kullanıcıyı timeout ile sustur (dakika olarak süre)',
    defaultMemberPermissions: PermissionsBitField.Flags.ModerateMembers,
    dmPermission: false,
    options: [
      {
        name: 'hedef',
        type: 6,
        description: 'Susturulacak kullanıcı',
        required: true
      },
      {
        name: 'süre',
        type: 4,
        description: 'Süre (dakika). Boş bırakılırsa 10 dakika uygulanır.',
        required: false
      },
      {
        name: 'sebep',
        type: 3,
        description: 'Susturma sebebi',
        required: false
      }
    ]
  },
  
  ,
  {
    name: 'setjoinlog',
    description: 'Giriş log kanalı ayarla',
    defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
    dmPermission: false,
    options: [
      {
        name: 'kanal',
        type: 7,
        description: 'Giriş loglarının gönderileceği kanal',
        required: true
      }
    ]
  },
  {
    name: 'setleavelog',
    description: 'Çıkış log kanalı ayarla',
    defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
    dmPermission: false,
    options: [
      {
        name: 'kanal',
        type: 7,
        description: 'Çıkış loglarının gönderileceği kanal',
        required: true
      }
    ]
  }
  ,
  {
    name: 'setspamwatch',
    description: 'Spam watch: izle ve ilet; watch=izlenen kanal, target=iletilecek kanal (opsiyonel)',
    defaultMemberPermissions: PermissionsBitField.Flags.Administrator,
    dmPermission: false,
    options: [
      {
        name: 'watch',
        type: 7,
        description: 'İzlenecek kanal (mesajlar burada sayılır)',
        required: true
      },
      {
        name: 'target',
        type: 7,
        description: 'İletilecek kanal (boşsa izlenen kanala iletilir)',
        required: false
      }
    ]
  }
];

// Guild settings storage (announcement, join log, leave log channels)
const SETTINGS_FILE = path.resolve(__dirname, 'guild_settings.json');
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

// Runtime spam watch state: per guild -> per channel
const spamState = {};

client.once('ready', async () => {
  console.log(`${client.user.tag} aktif!`);

  try {
    await client.guilds.fetch();
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(slashCommands.filter(Boolean));
      console.log(`Slash komutlar ${guild.name} sunucusuna kaydedildi.`);
    }
  } catch (error) {
    console.error('Slash komut kaydı sırasında hata:', error);
  }
});

client.on('error', error => {
  console.error('Client error:', error);
});

client.on('shardError', error => {
  console.error('Shard error:', error);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction.commandName;

  // Slash: ping - show latency in ms
  if (cmd === 'ping') {
    try {
      const latency = Math.abs(Date.now() - interaction.createdTimestamp);
      const ws = Math.round(interaction.client.ws.ping || 0);
      return interaction.reply({ content: `Şu anki gecikme: ${latency}ms (WS: ${ws}ms)` });
    } catch (err) {
      console.error('Ping komutu hatası:', err);
      try {
        return interaction.reply({ content: 'Ping hesaplanırken hata oluştu.', flags: MessageFlags.Ephemeral });
      } catch (replyErr) {
        console.error('Ping hata mesajı gönderilemedi:', replyErr);
        return null;
      }
    }
  }

  // DM duyuru
  if (cmd === 'dmduyuru') {
    if (!interaction.guild) {
      return interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', flags: MessageFlags.Ephemeral });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', flags: MessageFlags.Ephemeral });
    }

    const announcement = interaction.options.getString('mesaj');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.guild.members.fetch();
    } catch (fetchError) {
      console.error('Üye önbelleği alınamadı:', fetchError);
    }

    const members = interaction.guild.members.cache.filter(member => !member.user.bot && member.id !== client.user.id);
    let success = 0;
    let fail = 0;

    for (const member of members.values()) {
      try {
        await member.send(announcement);
        success += 1;
      } catch (sendError) {
        fail += 1;
        if (sendError && sendError.status === 429) {
          const retry = sendError.retryAfter || DM_ANNOUNCEMENT_DELAY_MS;
          console.warn(`DM rate limited, waiting ${retry}ms`);
          await new Promise(resolve => setTimeout(resolve, retry));
        }
      }
      await new Promise(resolve => setTimeout(resolve, DM_ANNOUNCEMENT_DELAY_MS));
    }

    return interaction.editReply(`DM duyurusu tamamlandı. Başarılı: ${success}, başarısız: ${fail}`);
  }

  

  // Slash: setjoinlog
  if (cmd === 'setjoinlog') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return interaction.editReply('Bu komut sunucuda kullanılmalıdır.');
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');

    const channel = interaction.options.getChannel('kanal');
    if (!channel) return interaction.editReply('Lütfen geçerli bir kanal seçin.');
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.editReply('Lütfen bir metin kanalı seçin.');
    }

    guildSettings[interaction.guild.id] = guildSettings[interaction.guild.id] || {};
    guildSettings[interaction.guild.id].joinLog = channel.id;
    saveGuildSettings();
    return interaction.editReply(`Giriş log kanalı ${channel.name} olarak ayarlandı.`);
  }

  // Slash: setleavelog
  if (cmd === 'setleavelog') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return interaction.editReply('Bu komut sunucuda kullanılmalıdır.');
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');

    const channel = interaction.options.getChannel('kanal');
    if (!channel) return interaction.editReply('Lütfen geçerli bir kanal seçin.');
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.editReply('Lütfen bir metin kanalı seçin.');
    }

    guildSettings[interaction.guild.id] = guildSettings[interaction.guild.id] || {};
    guildSettings[interaction.guild.id].leaveLog = channel.id;
    saveGuildSettings();
    return interaction.editReply(`Çıkış log kanalı ${channel.name} olarak ayarlandı.`);
  }

  // Slash: setspamwatch
  if (cmd === 'setspamwatch') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return interaction.editReply('Bu komut sunucuda kullanılmalıdır.');
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.editReply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');

    const watch = interaction.options.getChannel('watch');
    const target = interaction.options.getChannel('target');
    if (!watch) return interaction.editReply('Lütfen izlenecek bir kanal seçin.');
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(watch.type)) return interaction.editReply('Lütfen izlenecek kanal olarak bir metin kanalı seçin.');
    if (target && ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(target.type)) return interaction.editReply('Lütfen hedef kanal olarak bir metin kanalı seçin.');

    guildSettings[interaction.guild.id] = guildSettings[interaction.guild.id] || {};
    guildSettings[interaction.guild.id].spamWatch = watch.id;
    if (target) guildSettings[interaction.guild.id].spamTarget = target.id;
    saveGuildSettings();
    return interaction.editReply(`Spam watch ayarlandı. İzlenen: ${watch.name}${target ? `, hedef: ${target.name}` : ''}`);
  }

  // Ban
  if (cmd === 'ban') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return interaction.editReply('Bu komut sunucuda kullanılmalıdır.');
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.editReply('Yeterli iznin yok.');

    const user = interaction.options.getUser('hedef');
    const reason = interaction.options.getString('sebep') || `Yasaklandı by ${interaction.user.tag}`;
    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.editReply('Botun yeterli izni yok.');
      await member.ban({ reason });
      return interaction.editReply(`${user.tag} başarıyla yasaklandı. Sebep: ${reason}`);
    } catch (err) {
      console.error('Ban hatası:', err);
      return interaction.editReply('Yasaklama sırasında bir hata oluştu.');
    }
  }

  // Kick
  if (cmd === 'kick') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return interaction.editReply('Bu komut sunucuda kullanılmalıdır.');
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.editReply('Yeterli iznin yok.');

    const user = interaction.options.getUser('hedef');
    const reason = interaction.options.getString('sebep') || `Atıldı by ${interaction.user.tag}`;
    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.editReply('Botun yeterli izni yok.');
      await member.kick(reason);
      return interaction.editReply(`${user.tag} sunucudan atıldı. Sebep: ${reason}`);
    } catch (err) {
      console.error('Kick hatası:', err);
      return interaction.editReply('Atma sırasında bir hata oluştu.');
    }
  }

  // Mute (timeout)
  if (cmd === 'mute') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return interaction.editReply('Bu komut sunucuda kullanılmalıdır.');
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.editReply('Yeterli iznin yok.');

    const user = interaction.options.getUser('hedef');
    const minutes = interaction.options.getInteger('süre') || 10;
    const reason = interaction.options.getString('sebep') || `Susturuldu by ${interaction.user.tag}`;
    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.editReply('Botun yeterli izni yok.');
      const ms = Math.max(1, minutes) * 60 * 1000;
      await member.timeout(ms, reason);
      return interaction.editReply(`${user.tag} ${minutes} dakika susturuldu. Sebep: ${reason}`);
    } catch (err) {
      console.error('Mute hatası:', err);
      return interaction.editReply('Susturma sırasında bir hata oluştu.');
    }
  }
});

client.on('guildCreate', async guild => {
  try {
    await guild.commands.set(slashCommands.filter(Boolean));
    console.log(`Slash komutlar ${guild.name} sunucusuna kaydedildi (yeni sunucu).`);
  } catch (error) {
    console.error('Yeni sunucu için slash komut kaydı sırasında hata:', error);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const settings = guildSettings[member.guild.id] || {};
    // Announcement (public welcome)
    const announcementId = settings.announcement;
    if (announcementId) {
      const announcementChannel = member.guild.channels.cache.get(announcementId) || await member.guild.channels.fetch(announcementId).catch(() => null);
      if (announcementChannel && typeof announcementChannel.send === 'function') {
        const text = `Hoş geldin, ${member}! Sunucu üye sayısı: ${member.guild.memberCount}`;
        await announcementChannel.send(text);
      }
    }

    // Join log
    const joinLogId = settings.joinLog;
    if (joinLogId) {
      const joinChannel = member.guild.channels.cache.get(joinLogId) || await member.guild.channels.fetch(joinLogId).catch(() => null);
      if (joinChannel && typeof joinChannel.send === 'function') {
        const log = `Giriş: ${member.user.tag} (ID: ${member.id}) — Üye sayısı: ${member.guild.memberCount}`;
        await joinChannel.send(log);
      }
    }
  } catch (err) {
    console.error('Welcome message error:', err);
  }
});

client.on('guildMemberRemove', async member => {
  try {
    const settings = guildSettings[member.guild.id] || {};
    const leaveLogId = settings.leaveLog;
    if (!leaveLogId) return;

    const leaveChannel = member.guild.channels.cache.get(leaveLogId) || await member.guild.channels.fetch(leaveLogId).catch(() => null);
    if (!leaveChannel || typeof leaveChannel.send !== 'function') return;

    const log = `Ayrıldı: ${member.user.tag} (ID: ${member.id}) — Üye sayısı: ${member.guild.memberCount}`;
    await leaveChannel.send(log);
  } catch (err) {
    console.error('Leave log error:', err);
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (recentMessageIds.has(message.id)) return;
  recentMessageIds.add(message.id);
  setTimeout(() => recentMessageIds.delete(message.id), 15000);

  // Spam watch: track consecutive messages per channel
  try {
    const settings = guildSettings[message.guild.id] || {};
    const spamChannelId = settings.spamWatch;
    if (spamChannelId) {
      const gid = message.guild.id;
      const cid = message.channel.id;
      // Only watch the configured 'watch' channel
      if (spamChannelId !== cid) return;

      spamState[gid] = spamState[gid] || {};
      const chState = spamState[gid][cid] = spamState[gid][cid] || { authorId: null, count: 0, lastTs: 0, blockUntil: 0 };

      const now = Date.now();
      // If in blocking window: delete only
      if (chState.blockUntil && now < chState.blockUntil) {
        if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.delete().catch(() => {});
        }
        return;
      }

      // Reset count if last message was too long ago (>1.5s)
      if (!chState.lastTs || (now - chState.lastTs) > 1500) {
        chState.count = 1;
        chState.authorId = message.author.id;
      } else {
        if (chState.authorId === message.author.id) {
          chState.count = (chState.count || 0) + 1;
        } else {
          chState.authorId = message.author.id;
          chState.count = 1;
        }
      }
      chState.lastTs = now;

      if (chState.count >= 3) {
        chState.count = 0;
        chState.blockUntil = Date.now() + 2500; // 2.5 seconds
      }
    }
  } catch (err) {
    console.error('Spam watch error:', err);
  }

  if (message.content === '!ping') {
    return message.channel.send('Pong!');
  }

  const voiceMatch = message.content.match(/^\.voice\s+(.+)$/i);
  if (voiceMatch) {
    const commandKey = `${message.guild.id}:${message.author.id}:voice`;
    if (recentVoiceCommands.has(commandKey)) {
      return null;
    }
    recentVoiceCommands.add(commandKey);
    setTimeout(() => recentVoiceCommands.delete(commandKey), 1500);

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');
    }

    const channelId = voiceMatch[1].replace(/\D/g, '');
    if (!channelId) {
      return message.channel.send('Lütfen geçerli bir ses kanalı IDsi girin. Kullanım: `.voice <kanalId>`');
    }

    const processingKey = `${message.guild.id}:${message.author.id}:${channelId}`;
    if (processingVoiceCommands.has(processingKey)) {
      return null;
    }
    processingVoiceCommands.add(processingKey);

    try {
      const channel = message.guild.channels.cache.get(channelId) || await message.guild.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return message.channel.send('Geçerli bir ses kanalı bulunamadı. Lütfen kanal IDsi girin.');
      }

      const existingConnection = getVoiceConnection(message.guild.id);
      if (existingConnection) {
        if (existingConnection.joinConfig.channelId === channelId) {
          return message.reply('Bot zaten bu ses kanalında.');
        }
        existingConnection.destroy();
      }

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20000);
        return message.channel.send(`${channel.name} ses kanalına girdim.`);
      } catch (error) {
        connection.destroy();
        console.error('Ses kanalına girerken hata:', error);
        return message.channel.send('Ses kanalına girerken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      processingVoiceCommands.delete(processingKey);
    }
  }

  if (message.content.trim() === '.leave') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');
    }

    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      return message.channel.send('Bot şu anda hiçbir ses kanalında değil.');
    }

    connection.destroy();
    return message.channel.send('Ses kanalından ayrıldım.');
  }

  // Kanalda duyuru: ## <başlık> ## Başlık: ... Mesaj: ... (başlık sizin seçiminizdir)
  const kanalDuyuruMatch = message.content.match(/^##\s*(.+?)\s*##\s*Başlık:\s*(.+?)\s*Mesaj:\s*([\s\S]+)/i) || message.content.match(/^##\s*(.+?)\s*##\s*Baslik:\s*(.+?)\s*Mesaj:\s*([\s\S]+)/i);
  if (kanalDuyuruMatch) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');
    }

    const header = kanalDuyuruMatch[1].trim();
    const title = kanalDuyuruMatch[2].trim();
    const body = kanalDuyuruMatch[3].trim();

    if (!header || !title || !body) {
      return message.channel.send('Kullanım: `## <başlık> ## Başlık: <başlık> Mesaj: <mesaj>`');
    }

    try {
      await message.channel.send(`${header}\n**${title}**\n\n${body}`);
      return message.channel.send('Duyuru kanala gönderildi.');
    } catch (err) {
      console.error('Kanal duyurusu gönderilemedi:', err);
      return message.channel.send('Duyuru gönderilirken bir hata oluştu.');
    }
  }

  const dmMatch = message.content.match(/^(!dmduyuru|!dm duyuru)\s+([\s\S]+)/i);
  if (!dmMatch) return;

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.channel.send('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.');
  }

  const announcement = dmMatch[2].trim();
  if (!announcement) {
    return message.channel.send('Lütfen duyuru metnini girin. Kullanım: `!dmduyuru <duyuru>` veya `!dm duyuru <duyuru>`');
  }

  try {
    await message.guild.members.fetch();
  } catch (fetchError) {
    console.error('Üye önbelleği alınamadı:', fetchError);
  }

  const members = message.guild.members.cache.filter(member => !member.user.bot && member.id !== client.user.id);
  let success = 0;
  let fail = 0;

  for (const member of members.values()) {
    try {
      await member.send(announcement);
      success += 1;
    } catch (sendError) {
      fail += 1;
      if (sendError && sendError.status === 429) {
        const retry = sendError.retryAfter || DM_ANNOUNCEMENT_DELAY_MS;
        console.warn(`DM rate limited, waiting ${retry}ms`);
        await new Promise(resolve => setTimeout(resolve, retry));
      }
    }
    await new Promise(resolve => setTimeout(resolve, DM_ANNOUNCEMENT_DELAY_MS));
  }

  return message.channel.send(`DM duyurusu tamamlandı. Başarılı: ${success}, başarısız: ${fail}`);
});

client.login(token);
