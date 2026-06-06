const { ChannelType, PermissionsBitField } = require('discord.js');
const { replyEmbed } = require('../utils/embed');
const { guildSettings, saveGuildSettings } = require('../utils/guildSettings');

module.exports = {
  data: {
    name: 'setspamwatch',
    description: 'Spam watch: izle ve ilet; watch=izlenen kanal, target=iletilecek kanal (opsiyonel)',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      { name: 'watch', description: 'İzlenecek kanal (mesajlar burada sayılır)', type: 7, required: true },
      { name: 'target', description: 'İletilecek kanal (boşsa izlenen kanala iletilir)', type: 7, required: false }
    ]
  },

  async execute(interaction) {
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
};