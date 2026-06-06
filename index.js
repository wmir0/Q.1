require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, PermissionsBitField, MessageFlags, ChannelType, REST, Routes, EmbedBuilder } = require('discord.js');
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
const DM_ANNOUNCEMENT_DELAY_MS = 5000;

const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const tokenSource = process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : process.env.BOT_TOKEN ? 'BOT_TOKEN' : null;
const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD || process.env.SERVER_ID || null;
if (!token) {
  console.error('HATA: DISCORD_TOKEN veya BOT_TOKEN ortam değişkeni ayarlı değil.');
  process.exit(1);
}

console.log(`Token kaynağı: ${tokenSource}`);
if (guildId) console.log(`Guild komut kaydı için GUILD_ID: ${guildId}`);

const slashCommands = [
  {
    name: 'dmduyuru',
    description: 'Tüm sunucu üyelerine DM olarak duyuru gönderir',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      {
        name: 'baslik',
        description: 'Duyurunun başlığı',
        type: 3,
        required: true
      },
      {
        name: 'mesaj',
        description: 'Gönderilecek duyuru metni',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'dm',
    description: 'Belirtilen kullanıcıya bot aracılığıyla DM gönderir',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: true,
    options: [
      {
        name: 'hedef',
        description: 'Mesaj gönderilecek kullanıcı',
        type: 6,
        required: true
      },
      {
        name: 'mesaj',
        description: 'Gönderilecek mesaj',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'ping',
    description: 'Botun gecikmesini gösterir',
    dm_permission: false
  },
  {
    name: 'ban',
    description: 'Belirtilen kullanıcıyı sunucudan yasakla',
    default_member_permissions: PermissionsBitField.Flags.BanMembers.toString(),
    dm_permission: false,
    options: [
      {
        name: 'hedef',
        description: 'Yasaklanacak kullanıcı',
        type: 6,
        required: true
      },
      {
        name: 'sebep',
        description: 'Yasağın sebebi',
        type: 3,
        required: false
      }
    ]
  },
  {
    name: 'kick',
    description: 'Belirtilen kullanıcıyı sunucudan at',
    default_member_permissions: PermissionsBitField.Flags.KickMembers.toString(),
    dm_permission: false,
    options: [
      {
        name: 'hedef',
        description: 'Atılacak kullanıcı',
        type: 6,
        required: true
      },
      {
        name: 'sebep',
        description: 'Atılma sebebi',
        type: 3,
        required: false
      }
    ]
  },
  {
    name: 'mute',
    description: 'Kullanıcıyı timeout ile sustur (dakika olarak süre)',
    default_member_permissions: PermissionsBitField.Flags.ModerateMembers.toString(),
    dm_permission: false,
    options: [
      {
        name: 'hedef',
        description: 'Susturulacak kullanıcı',
        type: 6,
        required: true
      },
      {
        name: 'süre',
        description: 'Süre (dakika). Boş bırakılırsa 10 dakika uygulanır.',
        type: 4,
        required: false
      },
      {
        name: 'sebep',
        description: 'Susturma sebebi',
        type: 3,
        required: false
      }
    ]
  },
  {
    name: 'sil',
    description: 'Kanaldan son mesajları siler',
    default_member_permissions: PermissionsBitField.Flags.ManageMessages.toString(),
    dm_permission: false,
    options: [
      {
        name: 'sayi',
        description: 'Silinecek mesaj sayısı (1-200)',
        type: 4,
        required: true
      }
    ]
  },
  {
    name: 'setjoinlog',
    description: 'Giriş log kanalı ayarla',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      {
        name: 'kanal',
        description: 'Giriş loglarının gönderileceği kanal',
        type: 7,
        required: true
      }
    ]
  },
  {
    name: 'setleavelog',
    description: 'Çıkış log kanalı ayarla',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      {
        name: 'kanal',
        description: 'Çıkış loglarının gönderileceği kanal',
        type: 7,
        required: true
      }
    ]
  },
  {
    name: 'setspamwatch',
    description: 'Spam watch: izle ve ilet; watch=izlenen kanal, target=iletilecek kanal (opsiyonel)',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      {
        name: 'watch',
        description: 'İzlenecek kanal (mesajlar burada sayılır)',
        type: 7,
        required: true
      },
      {
        name: 'target',
        description: 'İletilecek kanal (boşsa izlenen kanala iletilir)',
        type: 7,
        required: false
      }
    ]
  },
  {
    name: 'voice',
    description: 'Botu belirtilen ses kanalına veya sizin bulunduğunuz ses kanalına bağlar',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      {
        name: 'kanal',
        description: 'Botun gireceği ses kanalı',
        type: 7,
        required: false
      }
    ]
  },
  {
    name: 'rol',
    description: 'Bir kullanıcıya rol verin veya rolünü alın',
    default_member_permissions: PermissionsBitField.Flags.ManageRoles.toString(),
    dm_permission: false,
    options: [
      {
        name: 'kullanici',
        description: 'Rol verilecek/alınacak kullanıcı',
        type: 6,
        required: true
      },
      {
        name: 'rol',
        description: 'Verilecek veya alınacak rol',
        type: 8,
        required: true
      },
      {
        name: 'islem',
        description: 'Rolü ver veya al',
        type: 3,
        required: true,
        choices: [
          { name: 'ver', value: 'ver' },
          { name: 'al', value: 'al' }
        ]
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

function makeEmbed({ title, description, fields, color = 0x00AE86, footer, timestamp = true }) {
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields) embed.addFields(fields);
  if (footer) {
    if (typeof footer === 'string') {
      embed.setFooter({ text: footer });
    } else {
      embed.setFooter(footer);
    }
  }
  if (timestamp) embed.setTimestamp();
  return embed;
}

async function replyEmbed(interaction, options) {
  const embed = makeEmbed(options);
  const payload = { embeds: [embed] };
  if (options.ephemeral) payload.flags = MessageFlags.Ephemeral;
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

// Runtime spam watch state: per guild -> per channel
const spamState = {};

client.once('ready', async () => {
  console.log(`${client.user.tag} aktif!`);

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    const shouldUseGuildRegistration = Boolean(guildId || client.guilds.cache.size > 0);

    if (shouldUseGuildRegistration) {
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      console.log('Global slash komutlar temizlendi.');
    }

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: slashCommands });
      console.log(`Slash komutlar guild ${guildId} için yüklendi.`);
    } else if (client.guilds.cache.size > 0) {
      const registerGuilds = client.guilds.cache.map(guild => {
        return rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: slashCommands })
          .then(() => console.log(`Slash komutlar guild ${guild.id} için yüklendi.`))
          .catch(err => console.error(`Guild ${guild.id} komut kaydı hatası:`, err));
      });
      await Promise.allSettled(registerGuilds);
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
      console.log('Slash komutlar global olarak yüklendi.');
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
      const embed = new EmbedBuilder()
        .setTitle('Ping Ölçümü')
        .setDescription('Botun gecikmesi aşağıda gösterilmiştir.')
        .setColor(0x00AE86)
        .addFields(
          { name: 'API Gecikmesi', value: `${latency}ms`, inline: true },
          { name: 'WebSocket', value: `${ws}ms`, inline: true }
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Ping komutu hatası:', err);
      try {
        return replyEmbed(interaction, { title: 'Hata', description: 'Ping hesaplanırken hata oluştu.', color: 0xE74C3C, ephemeral: true });
      } catch (replyErr) {
        console.error('Ping hata mesajı gönderilemedi:', replyErr);
        return null;
      }
    }
  }

  // Slash: rol - kullanıcıya rol ver veya rol al
  if (cmd === 'rol') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucuda kullanılabilir.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için Rollerimi Yönet iznine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const targetUser = interaction.options.getUser('kullanici');
    const role = interaction.options.getRole('rol');
    const action = interaction.options.getString('islem');

    if (!targetUser || !role || !action) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen kullanıcı, rol ve işlem seçin.', color: 0xE74C3C, ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Kullanıcı sunucuda bulunamadı.', color: 0xE74C3C, ephemeral: true });
    }

    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Botun Rollerimi Yönet izni yok.', color: 0xE74C3C, ephemeral: true });
    }

    if (role.managed) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Bu rol dış sistem tarafından yönetiliyor ve değiştirilemez.', color: 0xE74C3C, ephemeral: true });
    }

    const botHighest = interaction.guild.members.me.roles.highest;
    if (role.position >= botHighest.position) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Bu rolü yönetmek için botun rolü daha yüksek olmalı.', color: 0xE74C3C, ephemeral: true });
    }

    try {
      if (action === 'ver') {
        if (member.roles.cache.has(role.id)) {
          return replyEmbed(interaction, { title: 'Zaten Var', description: `${member.user.tag} kullanıcısı bu role zaten sahip.`, color: 0xF1C40F, ephemeral: true });
        }
        await member.roles.add(role, `Rol komutu: ${interaction.user.tag}`);
        return replyEmbed(interaction, {
          title: 'Rol Verildi',
          description: `${member.user.tag} kullanıcısına ${role.name} rolü verildi.`,
          color: 0x2ECC71,
          fields: [
            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
            { name: 'Rol', value: `${role.name}`, inline: true },
            { name: 'İşlem', value: 'Verildi', inline: true }
          ]
        });
      }

      if (action === 'al') {
        if (!member.roles.cache.has(role.id)) {
          return replyEmbed(interaction, { title: 'Rol Yok', description: `${member.user.tag} kullanıcısında bu rol yok.`, color: 0xF1C40F, ephemeral: true });
        }
        await member.roles.remove(role, `Rol komutu: ${interaction.user.tag}`);
        return replyEmbed(interaction, {
          title: 'Rol Alındı',
          description: `${member.user.tag} kullanıcısından ${role.name} rolü alındı.`,
          color: 0x2ECC71,
          fields: [
            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
            { name: 'Rol', value: `${role.name}`, inline: true },
            { name: 'İşlem', value: 'Alındı', inline: true }
          ]
        });
      }

      return replyEmbed(interaction, { title: 'Hata', description: 'Geçersiz işlem seçildi.', color: 0xE74C3C, ephemeral: true });
    } catch (err) {
      console.error('Rol komutu hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Rol verilirken veya alınırken bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
  }

  // Slash: voice
  if (cmd === 'voice') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucularda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    let channel = interaction.options.getChannel('kanal');
    if (!channel) {
      channel = interaction.member.voice.channel;
    }

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen bir ses kanalı seçin veya önce ses kanalına katılın.', color: 0xE74C3C, ephemeral: true });
    }

    const existingConnection = getVoiceConnection(interaction.guild.id);
    if (existingConnection) {
      if (existingConnection.joinConfig.channelId === channel.id) {
        return replyEmbed(interaction, { title: 'Bilgi', description: 'Bot zaten bu ses kanalında.', color: 0x3498DB, ephemeral: true });
      }
      existingConnection.destroy();
    }

    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      return replyEmbed(interaction, { title: 'Bağlandı', description: `${channel.name} ses kanalına bağlandım.`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('Voice komutu hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Ses kanalına bağlanırken bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
  }

  // DM duyuru
  if (cmd === 'dmduyuru') {
    if (!interaction.guild) {
      return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucularda kullanılabilir.', color: 0xF1C40F, ephemeral: true });
    }

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });
    }

    const title = interaction.options.getString('baslik');
    const announcement = interaction.options.getString('mesaj');
    let replyStarted = interaction.replied || interaction.deferred;

    if (!replyStarted) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        replyStarted = true;
      } catch (deferError) {
        console.error('Defer reply failed for dmduyuru:', deferError);
        try {
          await replyEmbed(interaction, { title: 'Bilgi', description: 'DM duyurusu başlatılıyor, lütfen bekleyin...', color: 0x3498DB, ephemeral: true });
          replyStarted = true;
        } catch (replyError) {
          console.error('Fallback reply failed for dmduyuru:', replyError);
        }
      }
    }

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
        const dmEmbed = makeEmbed({ title, description: announcement, color: 0x00AE86, timestamp: true });
        await member.send({ embeds: [dmEmbed] });
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

    const resultMessage = `DM duyurusu tamamlandı. Başarılı: ${success}, başarısız: ${fail}`;
    try {
      return replyEmbed(interaction, { title: 'DM Duyuru Sonucu', description: resultMessage, color: success > 0 ? 0x2ECC71 : 0xE74C3C, ephemeral: true });
    } catch (replyError) {
      console.error('DM duyurusu sonuç mesajı gönderilemedi:', replyError);
      if (!interaction.replied && !interaction.deferred) {
        return replyEmbed(interaction, { title: 'DM Duyuru Sonucu', description: resultMessage, color: success > 0 ? 0x2ECC71 : 0xE74C3C, ephemeral: true });
      }
      return null;
    }
  }

  // Slash: dm
  if (cmd === 'dm') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucularda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const target = interaction.options.getUser('hedef');
    const dmMessage = interaction.options.getString('mesaj');
    if (!target) return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen geçerli bir kullanıcı seçin.', color: 0xE74C3C, ephemeral: true });

    try {
      await target.send({ embeds: [makeEmbed({ title: 'Doğrudan Mesaj', description: dmMessage, color: 0x00AE86, timestamp: true })] });
      return replyEmbed(interaction, { title: 'Başarılı', description: `${target.tag} kullanıcısına DM gönderildi.`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('DM gönderilemedi:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'DM gönderilirken bir hata oluştu. Kullanıcının DMleri kapalı olabilir.', color: 0xE74C3C, ephemeral: true });
    }
  }

  // Slash: sil
  if (cmd === 'sil') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için Mesajları Yönet iznine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const count = interaction.options.getInteger('sayi');
    if (!count || count < 1 || count > 100) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen 1 ile 100 arasında bir sayı girin.', color: 0xE74C3C, ephemeral: true });
    }

    try {
      const deleted = await interaction.channel.bulkDelete(count, true);
      return replyEmbed(interaction, { title: 'Mesaj Silindi', description: `${deleted.size} mesaj silindi.`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('Silme hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Mesajları silerken bir hata oluştu. Belki 14 günden eski mesajlar vardır.', color: 0xE74C3C, ephemeral: true });
    }
  }

  // Slash: setjoinlog
  if (cmd === 'setjoinlog') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const channel = interaction.options.getChannel('kanal');
    if (!channel) return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen geçerli bir kanal seçin.', color: 0xE74C3C, ephemeral: true });
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen bir metin kanalı seçin.', color: 0xE74C3C, ephemeral: true });
    }

    guildSettings[interaction.guild.id] = guildSettings[interaction.guild.id] || {};
    guildSettings[interaction.guild.id].joinLog = channel.id;
    saveGuildSettings();
    return replyEmbed(interaction, { title: 'Ayarlandı', description: `Giriş log kanalı ${channel.name} olarak ayarlandı.`, color: 0x2ECC71, ephemeral: true });
  }

  // Slash: setleavelog
  if (cmd === 'setleavelog') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const channel = interaction.options.getChannel('kanal');
    if (!channel) return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen geçerli bir kanal seçin.', color: 0xE74C3C, ephemeral: true });
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen bir metin kanalı seçin.', color: 0xE74C3C, ephemeral: true });
    }

    guildSettings[interaction.guild.id] = guildSettings[interaction.guild.id] || {};
    guildSettings[interaction.guild.id].leaveLog = channel.id;
    saveGuildSettings();
    return replyEmbed(interaction, { title: 'Ayarlandı', description: `Çıkış log kanalı ${channel.name} olarak ayarlandı.`, color: 0x2ECC71, ephemeral: true });
  }

  // Slash: setspamwatch
  if (cmd === 'setspamwatch') {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const watch = interaction.options.getChannel('watch');
    const target = interaction.options.getChannel('target');
    if (!watch) return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen izlenecek bir kanal seçin.', color: 0xE74C3C, ephemeral: true });
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(watch.type)) return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen izlenecek kanal olarak bir metin kanalı seçin.', color: 0xE74C3C, ephemeral: true });
    if (target && ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(target.type)) return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen hedef kanal olarak bir metin kanalı seçin.', color: 0xE74C3C, ephemeral: true });

    guildSettings[interaction.guild.id] = guildSettings[interaction.guild.id] || {};
    guildSettings[interaction.guild.id].spamWatch = watch.id;
    if (target) guildSettings[interaction.guild.id].spamTarget = target.id;
    saveGuildSettings();
    return replyEmbed(interaction, { title: 'Ayarlandı', description: `Spam watch ayarlandı. İzlenen: ${watch.name}${target ? `, hedef: ${target.name}` : ''}`, color: 0x2ECC71, ephemeral: true });
  }

  // Ban
  if (cmd === 'ban') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Yeterli iznin yok.', color: 0xE74C3C, ephemeral: true });

    const user = interaction.options.getUser('hedef');
    const reason = interaction.options.getString('sebep') || `Yasaklandı by ${interaction.user.tag}`;
    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) return replyEmbed(interaction, { title: 'Hata', description: 'Botun yeterli izni yok.', color: 0xE74C3C, ephemeral: true });
      await member.ban({ reason });
      return replyEmbed(interaction, { title: 'Yasaklandı', description: `${user.tag} başarıyla yasaklandı. Sebep: ${reason}`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('Ban hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Yasaklama sırasında bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
  }

  // Kick
  if (cmd === 'kick') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Yeterli iznin yok.', color: 0xE74C3C, ephemeral: true });

    const user = interaction.options.getUser('hedef');
    const reason = interaction.options.getString('sebep') || `Atıldı by ${interaction.user.tag}`;
    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) return replyEmbed(interaction, { title: 'Hata', description: 'Botun yeterli izni yok.', color: 0xE74C3C, ephemeral: true });
      await member.kick(reason);
      return replyEmbed(interaction, { title: 'Atıldı', description: `${user.tag} sunucudan atıldı. Sebep: ${reason}`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('Kick hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Atma sırasında bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
  }

  // Mute (timeout)
  if (cmd === 'mute') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sunucuda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Yeterli iznin yok.', color: 0xE74C3C, ephemeral: true });

    const user = interaction.options.getUser('hedef');
    const minutes = interaction.options.getInteger('süre') || 10;
    const reason = interaction.options.getString('sebep') || `Susturuldu by ${interaction.user.tag}`;
    try {
      const member = await interaction.guild.members.fetch(user.id);
      if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return replyEmbed(interaction, { title: 'Hata', description: 'Botun yeterli izni yok.', color: 0xE74C3C, ephemeral: true });
      const ms = Math.max(1, minutes) * 60 * 1000;
      await member.timeout(ms, reason);
      return replyEmbed(interaction, { title: 'Susturuldu', description: `${user.tag} ${minutes} dakika susturuldu. Sebep: ${reason}`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('Mute hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Susturma sırasında bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
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
        const embed = makeEmbed({
          title: 'Yeni Üye Katıldı',
          description: `Hoş geldin, ${member}!`,
          fields: [{ name: 'Üye Sayısı', value: `${member.guild.memberCount}`, inline: true }],
          color: 0x00AE86
        });
        await announcementChannel.send({ embeds: [embed] });
      }
    }

    // Join log
    const joinLogId = settings.joinLog;
    if (joinLogId) {
      const joinChannel = member.guild.channels.cache.get(joinLogId) || await member.guild.channels.fetch(joinLogId).catch(() => null);
      if (joinChannel && typeof joinChannel.send === 'function') {
        const embed = makeEmbed({
          title: 'Üye Girişi',
          description: `${member.user.tag} sunucuya katıldı.`,
          fields: [
            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
            { name: 'Üye Sayısı', value: `${member.guild.memberCount}`, inline: true }
          ],
          color: 0x3498DB
        });
        await joinChannel.send({ embeds: [embed] });
      }
    }

    // DM welcome message
    try {
      const dmEmbed = makeEmbed({
        description: 'Bir kapı var. Çoğu kişi fark etmez bile. Ama açarsan geri dönüşü yok. Hoş geldin.\n\nhttps://discord.gg/PvtP3qPNZG',
        color: 0x00AE86,
        timestamp: false
      });
      await member.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.warn(`Yeni üyeye DM gönderilemedi: ${member.user.tag}`, dmError);
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

    const embed = makeEmbed({
      title: 'Üye Ayrıldı',
      description: `${member.user.tag} sunucudan ayrıldı.`,
      fields: [
        { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
        { name: 'Üye Sayısı', value: `${member.guild.memberCount}`, inline: true }
      ],
      color: 0xE67E22
    });
    await leaveChannel.send({ embeds: [embed] });
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
    const embed = makeEmbed({ title: 'Pong!', description: 'Komut başarıyla çalıştı.', color: 0x00AE86 });
    return message.channel.send({ embeds: [embed] });
  }

  if (message.content.startsWith('!bilgi')) {
    const args = message.content.split(/\s+/).slice(1);
    const targetMention = args[0];
    const target = targetMention ? message.mentions.users.first() || client.users.cache.get(targetMention.replace(/\D/g, '')) : null;

    if (target) {
      try {
        const user = await client.users.fetch(target.id, { force: true });
        const member = message.guild.members.cache.get(user.id) || await message.guild.members.fetch(user.id).catch(() => null);
        const roles = member ? member.roles.cache.filter(role => role.id !== message.guild.id).map(role => role.name).slice(0, 10) : [];
        const userEmbed = makeEmbed({
          title: `${user.tag} Bilgisi`,
          description: member ? `Sunucu içindeki bilgiler aşağıdadır.` : `Kullanıcı bilgileri aşağıdadır.`,
          color: 0x3498DB,
          fields: [
            { name: 'ID', value: user.id, inline: true },
            { name: 'Hesap', value: user.bot ? 'Bot' : 'Gerçek Kullanıcı', inline: true },
            { name: 'Sunucuya Katılma', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor', inline: true },
            { name: 'Hesap Oluşturma', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Roller', value: roles.length ? roles.join(', ') : (member ? 'Yok' : 'Bilinmiyor'), inline: false }
          ],
          footer: { text: `İsteyen: ${message.author.tag}` },
          timestamp: true
        });

        if (user.bannerURL({ dynamic: true, size: 1024 })) {
          userEmbed.setImage(user.bannerURL({ dynamic: true, size: 1024 }));
        }
        userEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }));
        return message.channel.send({ embeds: [userEmbed] });
      } catch (err) {
        console.error('!bilgi kullanıcı hatası:', err);
        return message.channel.send({ embeds: [makeEmbed({ title: 'Hata', description: 'Kullanıcı bilgileri alınamadı.', color: 0xE74C3C })] });
      }
    }

    const guild = message.guild;
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(member => member.presence && member.presence.status !== 'offline').size;
    const roleCount = guild.roles.cache.size;
    const textChannels = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(ch => ch.type === ChannelType.GuildVoice).size;
    const bannerURL = guild.bannerURL({ dynamic: true, size: 1024 });
    const iconURL = guild.iconURL({ dynamic: true, size: 512 });

    const guildEmbed = makeEmbed({
      title: `${guild.name} Sunucu Bilgisi`,
      description: guild.description || 'Sunucu açıklaması yok.',
      color: 0x1ABC9C,
      fields: [
        { name: 'Sunucu ID', value: guild.id, inline: true },
        { name: 'Sahip', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Üye Sayısı', value: `${totalMembers}`, inline: true },
        { name: 'Çevrimiçi', value: `${onlineMembers}`, inline: true },
        { name: 'Rol Sayısı', value: `${roleCount}`, inline: true },
        { name: 'Metin Kanalları', value: `${textChannels}`, inline: true },
        { name: 'Ses Kanalları', value: `${voiceChannels}`, inline: true },
        { name: 'Boost Seviyesi', value: `Tier ${guild.premiumTier || 0} (${guild.premiumSubscriptionCount || 0} boost)`, inline: true },
        { name: 'Oluşturulma', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
      ],
      footer: { text: `Komutu kullanan: ${message.author.tag}` },
      timestamp: true
    });
    if (iconURL) guildEmbed.setThumbnail(iconURL);
    if (bannerURL) guildEmbed.setImage(bannerURL);

    return message.channel.send({ embeds: [guildEmbed] });
  }

  if (message.content.trim() === '.leave') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send({ embeds: [makeEmbed({ title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C })] });
    }

    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      return message.channel.send({ embeds: [makeEmbed({ title: 'Bilgi', description: 'Bot şu anda hiçbir ses kanalında değil.', color: 0xF1C40F })] });
    }

    connection.destroy();
    return message.channel.send({ embeds: [makeEmbed({ title: 'Ayrıldı', description: 'Ses kanalından ayrıldım.', color: 0x2ECC71 })] });
  }

  // Kanalda duyuru: ## <başlık> ## Başlık: ... Mesaj: ... (başlık sizin seçiminizdir)
  const kanalDuyuruMatch = message.content.match(/^##\s*(.+?)\s*##\s*Başlık:\s*(.+?)\s*Mesaj:\s*([\s\S]+)/i) || message.content.match(/^##\s*(.+?)\s*##\s*Baslik:\s*(.+?)\s*Mesaj:\s*([\s\S]+)/i);
  if (kanalDuyuruMatch) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.channel.send({ embeds: [makeEmbed({ title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C })] });
    }

    const header = kanalDuyuruMatch[1].trim();
    const title = kanalDuyuruMatch[2].trim();
    const body = kanalDuyuruMatch[3].trim();

    if (!header || !title || !body) {
      return message.channel.send({ embeds: [makeEmbed({ title: 'Kullanım Hatası', description: 'Kullanım: `## <başlık> ## Başlık: <başlık> Mesaj: <mesaj>`', color: 0xE74C3C })] });
    }

    try {
      const announcementEmbed = makeEmbed({
        title: header,
        description: body,
        fields: [{ name: title, value: body }],
        color: 0x1ABC9C
      });
      await message.channel.send({ embeds: [announcementEmbed] });
      return message.channel.send({ embeds: [makeEmbed({ title: 'Duyuru Gönderildi', description: 'Kanal duyurusu başarıyla gönderildi.', color: 0x2ECC71 })] });
    } catch (err) {
      console.error('Kanal duyurusu gönderilemedi:', err);
      return message.channel.send({ embeds: [makeEmbed({ title: 'Hata', description: 'Duyuru gönderilirken bir hata oluştu.', color: 0xE74C3C })] });
    }
  }

  const dmMatch = message.content.match(/^(!dmduyuru|!dm duyuru)\s+([\s\S]+)/i);
  if (!dmMatch) return;

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.channel.send({ embeds: [makeEmbed({ title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C })] });
  }

  const announcement = dmMatch[2].trim();
  if (!announcement) {
    return message.channel.send({ embeds: [makeEmbed({ title: 'Eksik Metin', description: 'Lütfen duyuru metnini girin. Kullanım: `!dmduyuru <duyuru>` veya `!dm duyuru <duyuru>`', color: 0xE74C3C })] });
  }

  try {
    await message.guild.members.fetch();
  } catch (fetchError) {
    console.error('Üye önbelleği alınamadı:', fetchError);
  }

  const members = message.guild.members.cache.filter(member => !member.user.bot && member.id !== client.user.id);
  let success = 0;
  let fail = 0;

  const dmEmbed = makeEmbed({ title: 'Sunucu Duyurusu', description: announcement, color: 0x1ABC9C });

  for (const member of members.values()) {
    try {
      await member.send({ embeds: [dmEmbed] });
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

  return message.channel.send({ embeds: [makeEmbed({ title: 'DM Duyurusu Tamamlandı', description: `Başarılı: ${success}, başarısız: ${fail}`, color: 0x2ECC71 })] });
});

client.login(token);
