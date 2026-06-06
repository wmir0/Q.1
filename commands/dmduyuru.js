const { PermissionsBitField } = require('discord.js');
const { makeEmbed, replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'dmduyuru',
    description: 'Tüm sunucu üyelerine DM olarak duyuru gönderir',
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
    dm_permission: false,
    options: [
      { name: 'baslik', description: 'Duyurunun başlığı', type: 3, required: true },
      { name: 'mesaj', description: 'Gönderilecek duyuru metni', type: 3, required: true },
      { name: 'gorsel', description: 'Gönderilecek görsel (isteğe bağlı)', type: 11, required: false }
    ]
  },

  async execute(interaction) {
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucularda kullanılabilir.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const title = interaction.options.getString('baslik');
    const announcement = interaction.options.getString('mesaj');

    try {
      await interaction.deferReply({ flags: 64 });
    } catch (deferError) {
      console.error('Defer failed for dmduyuru:', deferError);
    }

    const attachment = interaction.options.getAttachment('gorsel');
    let imageUrl = null;
    if (attachment) {
      const isImage = attachment.contentType?.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(attachment.name || '');
      if (!isImage) {
        return replyEmbed(interaction, { title: 'Geçersiz Görsel', description: 'Lütfen geçerli bir resim dosyası ekleyin.', color: 0xE74C3C, ephemeral: true });
      }
      imageUrl = attachment.url;
    }

    try {
      await interaction.guild.members.fetch();
    } catch (fetchError) {
      console.error('Üye önbelleği alınamadı:', fetchError);
    }

    const members = interaction.guild.members.cache.filter(member => !member.user.bot && member.id !== interaction.client.user.id);
    let success = 0;
    let fail = 0;

    for (const member of members.values()) {
      try {
        const dmEmbed = makeEmbed({ title, description: announcement, color: 0x00AE86, timestamp: true, image: imageUrl });
        await member.send({ embeds: [dmEmbed] });
        success += 1;
      } catch (sendError) {
        fail += 1;
        if (sendError && sendError.status === 429) {
          const retry = sendError.retryAfter || 5000;
          console.warn(`DM rate limited, waiting ${retry}ms`);
          await new Promise(resolve => setTimeout(resolve, retry));
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return replyEmbed(interaction, { title: 'DM Duyuru Sonucu', description: `DM duyurusu tamamlandı. Başarılı: ${success}, başarısız: ${fail}`, color: success > 0 ? 0x2ECC71 : 0xE74C3C, ephemeral: true });
  }
};