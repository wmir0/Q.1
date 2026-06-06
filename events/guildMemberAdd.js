const { makeEmbed } = require('../utils/embed');
const { guildSettings } = require('../utils/guildSettings');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const settings = guildSettings[member.guild.id] || {};
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
  }
};