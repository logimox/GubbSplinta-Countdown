const applicationId = '1534662985707163809';
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('Set DISCORD_BOT_TOKEN in your shell before running this script.');
  process.exit(1);
}

const commands = [
  { name: 'välkommen', description: 'Välkomna de fyra spelarna till GubbSplinta' },
  { name: 'rsvp', description: 'Visa RSVP-panel för nästa match' },
  { name: 'stats', description: 'Visa fasta lag, RSVP och matchstatistik' },
  {
    name: 'minne',
    description: 'Spara ett GubbSplinta-minne',
    options: [{ name: 'text', description: 'Minnet som ska sparas', type: 3, required: true }]
  },
  {
    name: 'resultat',
    description: 'Registrera vinnande fasta lag',
    options: [{
      name: 'vinnare',
      description: 'Vinnande lag',
      type: 3,
      required: true,
      choices: [
        { name: 'Kakan + LogiMOX', value: 'kakan_logimox' },
        { name: 'Bjestavs + Doxos', value: 'bjestavs_doxos' }
      ]
    }]
  }
];

for (const command of commands) {
  const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Could not register /${command.name}: ${response.status} ${await response.text()}`);
  console.log(`Registered /${command.name}`);
}
