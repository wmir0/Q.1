const { ChannelType, PermissionsBitField } = require('discord.js');
const { replyEmbed } = require('../utils/embed');
const { guildSettings, saveGuildSettings } = require('../utils/guildSettings');

module.exports = {
  data: {
    name: 'setleavelog',
    description: 'Çıkış log kanalı ayarla',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      { name: 'kanal', description: 'Çıkış loglarının gönderileceği kanal', type: 7, required: true }
    ]
  },

  async execute(interaction) {
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
};