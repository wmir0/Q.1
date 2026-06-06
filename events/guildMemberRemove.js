const { makeEmbed } = require('../utils/embed');
const { guildSettings } = require('../utils/guildSettings');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
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
  }
};