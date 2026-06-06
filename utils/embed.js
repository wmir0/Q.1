const { EmbedBuilder, MessageFlags } = require('discord.js');

function makeEmbed({ title, description, fields, color = 0x00AE86, footer, timestamp = true }) {
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields) embed.addFields(fields);
  if (footer) {
    if (typeof footer === 'string') {
      embed.setFooter({ text: footer });
    } else {
      embed.setFooter(footer);
    }
  }
  if (timestamp) embed.setTimestamp();
  return embed;
}

async function replyEmbed(interaction, options) {
  const embed = makeEmbed(options);
  const payload = { embeds: [embed] };
  if (options.ephemeral) payload.flags = MessageFlags.Ephemeral;
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = { makeEmbed, replyEmbed };