const { makeEmbed } = require('../utils/embed');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({ embeds: [makeEmbed({ title: 'Hata', description: 'Bilinmeyen komut.', color: 0xE74C3C })], ephemeral: true });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Komut hatası (${interaction.commandName}):`, error);
      await interaction.reply({ embeds: [makeEmbed({ title: 'Hata', description: 'Komut çalıştırılırken hata oluştu.', color: 0xE74C3C })], ephemeral: true });
    }
  }
};