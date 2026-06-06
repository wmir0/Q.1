const { PermissionsBitField, MessageFlags, ChannelType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const { replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'voice',
    description: 'Botu belirtilen ses kanalına veya sizin bulunduğunuz ses kanalına bağlar',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      { name: 'kanal', description: 'Botun gireceği ses kanalı', type: 7, required: false }
    ]
  },

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucularda kullanılmalıdır.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    let channel = interaction.options.getChannel('kanal');
    if (!channel) channel = interaction.member.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen bir ses kanalı seçin veya önce ses kanalına katılın.', color: 0xE74C3C, ephemeral: true });
    }

    const existingConnection = getVoiceConnection(interaction.guild.id);
    if (existingConnection) {
      if (existingConnection.joinConfig.channelId === channel.id) {
        return replyEmbed(interaction, { title: 'Bilgi', description: 'Bot zaten bu ses kanalında.', color: 0x3498DB, ephemeral: true });
      }
      existingConnection.destroy();
    }

    try {
      const connection = joinVoiceChannel({ channelId: channel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
      await entersState(connection, VoiceConnectionStatus.Ready, 20000);
      return replyEmbed(interaction, { title: 'Bağlandı', description: `${channel.name} ses kanalına bağlandım.`, color: 0x2ECC71, ephemeral: true });
    } catch (err) {
      console.error('Voice komutu hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Ses kanalına bağlanırken bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
  }
};