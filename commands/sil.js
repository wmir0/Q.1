const { PermissionsBitField } = require('discord.js');
const { replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'sil',
    description: 'Kanaldan son mesajları siler',
    default_member_permissions: PermissionsBitField.Flags.ManageMessages.toString(),
    dm_permission: false,
    options: [
      { name: 'sayi', description: 'Silinecek mesaj sayısı (1-200)', type: 4, required: true }
    ]
  },

  async execute(interaction) {
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
};