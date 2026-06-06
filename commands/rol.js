const { PermissionsBitField } = require('discord.js');
const { replyEmbed } = require('../utils/embed');

module.exports = {
  data: {
    name: 'rol',
    description: 'Bir kullanıcıya rol verin veya rolünü alın',
    default_member_permissions: PermissionsBitField.Flags.ManageRoles.toString(),
    dm_permission: false,
    options: [
      { name: 'kullanici', description: 'Rol verilecek/alınacak kullanıcı', type: 6, required: true },
      { name: 'rol', description: 'Verilecek veya alınacak rol', type: 8, required: true },
      { name: 'islem', description: 'Rolü ver veya al', type: 3, required: true, choices: [
        { name: 'ver', value: 'ver' },
        { name: 'al', value: 'al' }
      ] }
    ]
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return replyEmbed(interaction, { title: 'Uyarı', description: 'Bu komut sadece sunucuda kullanılabilir.', color: 0xF1C40F, ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) return replyEmbed(interaction, { title: 'Yetki Hatası', description: 'Bu komutu kullanmak için Rollerimi Yönet iznine sahip olmanız gerekir.', color: 0xE74C3C, ephemeral: true });

    const targetUser = interaction.options.getUser('kullanici');
    const role = interaction.options.getRole('rol');
    const action = interaction.options.getString('islem');

    if (!targetUser || !role || !action) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Lütfen kullanıcı, rol ve işlem seçin.', color: 0xE74C3C, ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Kullanıcı sunucuda bulunamadı.', color: 0xE74C3C, ephemeral: true });
    }

    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Botun Rollerimi Yönet izni yok.', color: 0xE74C3C, ephemeral: true });
    }

    if (role.managed) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Bu rol dış sistem tarafından yönetiliyor ve değiştirilemez.', color: 0xE74C3C, ephemeral: true });
    }

    const botHighest = interaction.guild.members.me.roles.highest;
    if (role.position >= botHighest.position) {
      return replyEmbed(interaction, { title: 'Hata', description: 'Bu rolü yönetmek için botun rolü daha yüksek olmalı.', color: 0xE74C3C, ephemeral: true });
    }

    try {
      if (action === 'ver') {
        if (member.roles.cache.has(role.id)) {
          return replyEmbed(interaction, { title: 'Zaten Var', description: `${member.user.tag} kullanıcısı bu role zaten sahip.`, color: 0xF1C40F, ephemeral: true });
        }
        await member.roles.add(role, `Rol komutu: ${interaction.user.tag}`);
        return replyEmbed(interaction, {
          title: 'Rol Verildi',
          description: `${member.user.tag} kullanıcısına ${role.name} rolü verildi.`,
          color: 0x2ECC71,
          fields: [
            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
            { name: 'Rol', value: `${role.name}`, inline: true },
            { name: 'İşlem', value: 'Verildi', inline: true }
          ]
        });
      }

      if (action === 'al') {
        if (!member.roles.cache.has(role.id)) {
          return replyEmbed(interaction, { title: 'Rol Yok', description: `${member.user.tag} kullanıcısında bu rol yok.`, color: 0xF1C40F, ephemeral: true });
        }
        await member.roles.remove(role, `Rol komutu: ${interaction.user.tag}`);
        return replyEmbed(interaction, {
          title: 'Rol Alındı',
          description: `${member.user.tag} kullanıcısından ${role.name} rolü alındı.`,
          color: 0x2ECC71,
          fields: [
            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
            { name: 'Rol', value: `${role.name}`, inline: true },
            { name: 'İşlem', value: 'Alındı', inline: true }
          ]
        });
      }

      return replyEmbed(interaction, { title: 'Hata', description: 'Geçersiz işlem seçildi.', color: 0xE74C3C, ephemeral: true });
    } catch (err) {
      console.error('Rol komutu hatası:', err);
      return replyEmbed(interaction, { title: 'Hata', description: 'Rol verilirken veya alınırken bir hata oluştu.', color: 0xE74C3C, ephemeral: true });
    }
  }
};