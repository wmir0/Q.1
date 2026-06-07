const { ChannelType, EmbedBuilder } = require('discord.js');
const { makeEmbed } = require('./embed');

const MODMAIL_CHANNEL_ID = '1513180695818801276';
const REPLY_PREFIX = '!cevap';
const processedMessages = new Set();

function formatAttachments(message) {
  if (!message.attachments.size) return null;
  return message.attachments.map(attachment => attachment.url).join('\n');
}

async function sendUserDm(client, userId, content) {
  const user = await client.users.fetch(userId);
  return user.send(content);
}

async function handleModmail(message) {
  if (message.author.bot) return true;
  if (processedMessages.has(message.id)) return true;

  if (message.channel.type === ChannelType.DM || message.channel.id === MODMAIL_CHANNEL_ID) {
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 60000);
  }

  if (message.channel.type === ChannelType.DM) {
    const modmailChannel = await message.client.channels.fetch(MODMAIL_CHANNEL_ID).catch(() => null);
    if (!modmailChannel || !modmailChannel.isTextBased()) return true;

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
    return true;
  }

  if (message.channel.id !== MODMAIL_CHANNEL_ID) return false;
  if (!message.content.startsWith(REPLY_PREFIX)) return false;

  const [, userId, ...replyParts] = message.content.trim().split(/\s+/);
  const replyText = replyParts.join(' ').trim();

  if (!userId || !replyText) {
    await message.reply(`Kullanım: \`${REPLY_PREFIX} kullanıcıID mesajın\``);
    return true;
  }

  try {
    await sendUserDm(message.client, userId, replyText);
  } catch (err) {
    console.error('Modmail cevap hatası:', err);
    await message.reply({
      embeds: [
        makeEmbed({
          title: 'Cevap Gönderilemedi',
          description: 'Kullanıcının DM kutusu kapalı olabilir veya ID hatalı olabilir.',
          color: 0xE74C3C
        })
      ]
    });
  }

  return true;
}

module.exports = { handleModmail };
