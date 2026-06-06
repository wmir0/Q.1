const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: {
    name: 'ping',
    description: 'Botun gecikmesini gösterir',
    dm_permission: false
  },

  async execute(interaction) {
    const latency = Math.abs(Date.now() - interaction.createdTimestamp);
    const ws = Math.round(interaction.client.ws.ping || 0);
    const embed = new EmbedBuilder()
      .setTitle('Ping Ölçümü')
      .setDescription('Botun gecikmesi aşağıda gösterilmiştir.')
      .setColor(0x00AE86)
      .addFields(
        { name: 'API Gecikmesi', value: `${latency}ms`, inline: true },
        { name: 'WebSocket', value: `${ws}ms`, inline: true }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};