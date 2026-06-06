const { makeEmbed } = require('../utils/embed');
const { getLevelData, progressBar } = require('../utils/levelSystem');

module.exports = {
  data: {
    name: 'level',
    description: 'Seviye bilgilerinizi veya bir kullanıcıyı gösterir',
    dm_permission: false,
    options: [
      {
        name: 'kullanici',
        description: 'Seviye bilgisi gösterilecek kullanıcı',
        type: 6,
        required: false
      }
    ]
  },

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('kullanici') || interaction.user;
    const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
    const levelData = getLevelData(interaction.guild.id, target.id);

    const embed = makeEmbed({
      title: `${target.tag} Seviye Kartı`,
      description: `${targetMember ? targetMember.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.name).slice(0, 5).join(', ') : 'Rol bilgisi yok.'}`,
      color: 0x9B59B6,
      thumbnail: target.displayAvatarURL({ dynamic: true, size: 512 }),
      fields: [
        { name: 'Seviye', value: `${levelData.level}`, inline: true },
        { name: 'XP', value: `${levelData.currentXp}/${levelData.nextThreshold}`, inline: true },
        { name: 'Cümle Sayısı', value: `${levelData.sentences}`, inline: true },
        { name: 'Kalan XP', value: `${levelData.remainingXp}`, inline: true },
        { name: 'İlerleme', value: progressBar(levelData.currentXp, levelData.nextThreshold), inline: false }
      ],
      footer: { text: `Komutu kullanan: ${interaction.user.tag}` },
      timestamp: true
    });

    return interaction.editReply({ embeds: [embed] });
  }
};