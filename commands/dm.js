const { PermissionsBitField, MessageFlags } = require('discord.js');
const { makeEmbed, replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'dm',
    description: 'Belirtilen kullanıcıya bot aracılığıyla DM gönderir',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: true,
    options: [
      { name: 'hedef', description: 'Mesaj gönderilecek kullanıcı', type: 6, required: true },
      { name: 'mesaj', description: 'Gönderilecek mesaj', type: 3, required: true }
    ]
  },

  async execute(interaction) {
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
};