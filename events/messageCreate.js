const { ChannelType, PermissionsBitField } = require('discord.js');
const { makeEmbed } = require('../utils/embed');
const spamState = {};
const recentMessageIds = new Set();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    if (recentMessageIds.has(message.id)) return;
    recentMessageIds.add(message.id);
    setTimeout(() => recentMessageIds.delete(message.id), 15000);

    try {
      const settings = require('../utils/guildSettings').guildSettings;
      const spamChannelId = settings[message.guild.id]?.spamWatch;
      if (spamChannelId) {
        const gid = message.guild.id;
        const cid = message.channel.id;
        if (spamChannelId !== cid) return;

        spamState[gid] = spamState[gid] || {};
        const chState = spamState[gid][cid] = spamState[gid][cid] || { authorId: null, count: 0, lastTs: 0, blockUntil: 0 };

        const now = Date.now();
        if (chState.blockUntil && now < chState.blockUntil) {
          if (message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            await message.delete().catch(() => {});
          }
          return;
        }

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
          chState.blockUntil = Date.now() + 2500;
        }
      }
    } catch (err) {
      console.error('Spam watch error:', err);
    }

    if (message.content === '!ping') {
      return message.channel.send({ embeds: [makeEmbed({ title: 'Pong!', description: 'Komut başarıyla çalıştı.', color: 0x00AE86 })] });
    }

    if (message.content.startsWith('!bilgi')) {
      const args = message.content.split(/\s+/).slice(1);
      const targetMention = args[0];
      const target = targetMention ? message.mentions.users.first() || message.client.users.cache.get(targetMention.replace(/\D/g, '')) : null;

      if (target) {
        try {
          const user = await message.client.users.fetch(target.id, { force: true });
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

      const connection = require('@discordjs/voice').getVoiceConnection(message.guild.id);
      if (!connection) {
        return message.channel.send({ embeds: [makeEmbed({ title: 'Bilgi', description: 'Bot şu anda hiçbir ses kanalında değil.', color: 0xF1C40F })] });
      }

      connection.destroy();
      return message.channel.send({ embeds: [makeEmbed({ title: 'Ayrıldı', description: 'Ses kanalından ayrıldım.', color: 0x2ECC71 })] });
    }

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

    const members = message.guild.members.cache.filter(member => !member.user.bot && member.id !== message.client.user.id);
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
          const retry = sendError.retryAfter || 5000;
          console.warn(`DM rate limited, waiting ${retry}ms`);
          await new Promise(resolve => setTimeout(resolve, retry));
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return message.channel.send({ embeds: [makeEmbed({ title: 'DM Duyurusu Tamamlandı', description: `Başarılı: ${success}, başarısız: ${fail}`, color: 0x2ECC71 })] });
  }
};