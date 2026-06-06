const { REST, Routes } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`${client.user.tag} aktif!`);

    const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD || process.env.SERVER_ID || null;

    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const shouldUseGuildRegistration = Boolean(guildId || client.guilds.cache.size > 0);

      if (shouldUseGuildRegistration) {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log('Global slash komutlar temizlendi.');
      }

      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: client.commands.map(command => command.data) });
        console.log(`Slash komutlar guild ${guildId} için yüklendi.`);
      } else if (client.guilds.cache.size > 0) {
        const registerGuilds = client.guilds.cache.map(guild => {
          return rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: client.commands.map(command => command.data) })
            .then(() => console.log(`Slash komutlar guild ${guild.id} için yüklendi.`))
            .catch(err => console.error(`Guild ${guild.id} komut kaydı hatası:`, err));
        });
        await Promise.allSettled(registerGuilds);
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), { body: client.commands.map(command => command.data) });
        console.log('Slash komutlar global olarak yüklendi.');
      }
    } catch (error) {
      console.error('Slash komut kaydı sırasında hata:', error);
    }
  }
};