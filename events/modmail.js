const { ChannelType, EmbedBuilder } = require('discord.js');
const { makeEmbed } = require('../utils/embed');

const MODMAIL_CHANNEL_ID = '1513180695818801276';
const REPLY_PREFIX = '!cevap';

function formatAttachments(message) {
  if (!message.attachments.size) return null;
  return message.attachments.map(attachment => attachment.url).join('\n');
}

async function sendUserDm(client, userId, content) {
  const user = await client.users.fetch(userId);
  return user.send(content);
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
      const modmailChannel = await message.client.channels.fetch(MODMAIL_CHANNEL_ID).catch(() => null);
      if (!modmailChannel || !modmailChannel.isTextBased()) return;

      const attachmentText = formatAttachments(message);
      const embed = new EmbedBuilder()
        .setTitle('Yeni DM')
        .setColor(0x9B59B6)
        .setAuthor({
          name: `${message.author.tag}`,
          iconURL: message.author.displayAvatarURL({ size: 256 })
        })
        .setDescription(message.content || '(Mesaj yazısı yok)')
        .addFields(
          { name: 'Kullanıcı', value: `${message.author} (${message.author.id})`, inline: false },
          { name: 'Cevap', value: `\`${REPLY_PREFIX} ${message.author.id} mesajın\``, inline: false }
        )
        .setFooter({ text: `Kullanıcı ID: ${message.author.id}` })
        .setTimestamp();

      if (attachmentText) {
        embed.addFields({ name: 'Ekler', value: attachmentText.slice(0, 1024), inline: false });
        const firstImage = message.attachments.find(attachment => attachment.contentType?.startsWith('image/'));
        if (firstImage) embed.setImage(firstImage.url);
      }

      await modmailChannel.send({ embeds: [embed] });
      return;
    }

    if (message.channel.id !== MODMAIL_CHANNEL_ID) return;
    if (!message.content.startsWith(REPLY_PREFIX)) return;

    const [, userId, ...replyParts] = message.content.trim().split(/\s+/);
    const replyText = replyParts.join(' ').trim();

    if (!userId || !replyText) {
      return message.reply(`Kullanım: \`${REPLY_PREFIX} kullanıcıID mesajın\``);
    }

    try {
      await sendUserDm(message.client, userId, replyText);
      return;
    } catch (err) {
      console.error('Modmail cevap hatası:', err);
      return message.reply({
        embeds: [
          makeEmbed({
            title: 'Cevap Gönderilemedi',
            description: 'Kullanıcının DM kutusu kapalı olabilir veya ID hatalı olabilir.',
            color: 0xE74C3C
          })
        ]
      });
    }
  }
};
