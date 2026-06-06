const { PermissionsBitField, MessageFlags } = require('discord.js');
const { replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'mute',
    description: 'Kullanıcıyı timeout ile sustur (dakika olarak süre)',
    default_member_permissions: PermissionsBitField.Flags.ModerateMembers.toString(),
    dm_permission: false,
    options: [
      { name: 'hedef', description: 'Susturulacak kullanıcı', type: 6, required: true },
      { name: 'süre', description: 'Süre (dakika). Boş bırakılırsa 10 dakika uygulanır.', type: 4, required: false },
      { name: 'sebep', description: 'Susturma sebebi', type: 3, required: false }
    ]
  },

  async execute(interaction) {
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
};