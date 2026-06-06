const { makeEmbed } = require('../utils/embed');
const { levelData } = require('../utils/levelSystem');

module.exports = {
  data: {
    name: 'liderlik-tablosu',
    description: 'Sunucunun XP ve level sıralaması',
    dm_permission: false
  },

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;

    // Sadece bu sunucunun verileri
    const users = Object.entries(levelData)
      .filter(([key]) => key.startsWith(guildId));

    if (users.length === 0) {
      return interaction.editReply({
        content: 'Bu sunucuda henüz level verisi yok.'
      });
    }

    // Sırala: level + XP
    const sorted = users.sort((a, b) => {
      const A = a[1];
      const B = b[1];

      if (B.level !== A.level) return B.level - A.level;
      return B.currentXp - A.currentXp;
    });

    // 🔥 İLK 10 KİŞİ
    const top10 = sorted.slice(0, 10);

    const description = top10.map((item, i) => {
      const userId = item[0].split('-')[1];
      const data = item[1];

      return `**#${i + 1}** <@${userId}> — Level **${data.level}** | XP **${data.currentXp}**`;
    }).join('\n');

    const embed = makeEmbed({
      title: '🏆 Liderlik Tablosu (Top 10)',
      description: description || 'Veri yok',
      color: 0xF1C40F,
      footer: { text: `Sunucu: ${interaction.guild.name}` },
      timestamp: true
    });

    return interaction.editReply({ embeds: [embed] });
  }
};