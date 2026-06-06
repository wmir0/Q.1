const { PermissionsBitField, MessageFlags } = require('discord.js');
const { replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'kick',
    description: 'Belirtilen kullanıcıyı sunucudan at',
    default_member_permissions: PermissionsBitField.Flags.KickMembers.toString(),
    dm_permission: false,
    options: [
      { name: 'hedef', description: 'Atılacak kullanıcı', type: 6, required: true },
      { name: 'sebep', description: 'Atılma sebebi', type: 3, required: false }
    ]
  },

  async execute(interaction) {
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
};