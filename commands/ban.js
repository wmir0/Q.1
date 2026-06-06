const { PermissionsBitField, MessageFlags } = require('discord.js');
const { replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'ban',
    description: 'Belirtilen kullanıcıyı sunucudan yasakla',
    default_member_permissions: PermissionsBitField.Flags.BanMembers.toString(),
    dm_permission: false,
    options: [
      { name: 'hedef', description: 'Yasaklanacak kullanıcı', type: 6, required: true },
      { name: 'sebep', description: 'Yasağın sebebi', type: 3, required: false }
    ]
  },

  async execute(interaction) {
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
};