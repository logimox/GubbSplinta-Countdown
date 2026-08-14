# GubbSplinta Countdown + Third Echelon rollterminal

Sidan: https://logimox.github.io/GubbSplinta-Countdown/

## Installera som app (PWA)

GubbSplinta kan installeras på Android, iPhone/iPad och datorer med egen ikon och fristående appfönster. På Android/desktop visar sidan en **Installera GubbSplinta**-knapp när webbläsaren stödjer direktinstallation. På iPhone/iPad: öppna sidan i Safari → **Dela** → **Lägg till på hemskärmen**. Senaste appskal och banlista sparas även för offlineöppning; inloggning, RSVP och Discord-data kräver fortfarande internet.

Cloudflare-workern behåller den tidigare `POST /post-maps`-funktionen och lägger till en Discord-rollväljare i Splinter Cell: Chaos Theory-stil.

## Rollterminalen

Med Discords slashkommando `/roles` skickar boten en privat kontrollpanel med knappar:

### Splinter Cell: Chaos Theory

- 🕵️ Ventilationsnisse — smyger in, stjäl intel och ber om ursäkt till luftkanalen.
- 🔦 Ficklampsfascist — minigun, lampa och noll tålamod för mörker.
- 🃏 Misstänkt Dubbelagent — alla litar på dig; det är exakt problemet.
- 🥽 Sam Fisher Fanclub — tre gröna lampor och absolut inga knäproblem.
- 🟢 Grön-Lamps-Syndikatet — Chaos Theory med fler skuggor än ansvar.
- ⚔️ Spion mot Ficklampa — diplomatin är inställd; batterierna är laddade.
- 🪑 SvM-Pensionär — minns när Mercs såg något och kallade det taktik.

### Deep Rock Galactic

- 🔫 Fackel-Influencer — Scout som lyser upp grottan och glömmer laget.
- 💥 Bly-Sommelier — Gunner med toner av krut, bly och panik.
- ⛏️ Geologisk Olycka — Driller som gör genvägar genom precis allt.
- 🛠️ Plattformskonsult — Engineer som löser även känslor med plattformar.
- 🍺 FOR KARL! — du vet inte varför vi ropar, men du ropar högst.
- ✊ Rock and Stone! — certifierad dvärg; HR godkänner motvilligt.
- 🐴 Mollys Fackombud — kräver raster och mindre sprängradie kring M.U.L.E.
- 🌿 Leaf Lover (misstänkt) — utredning pågår efter salladsbeställning på Abyss Bar.

Ett nytt val inom samma grupp ersätter det gamla. Det finns fyra separata grupper: Splinter-lag, Splinter-läge, Deep Rock-klass och Deep Rock-heders-/ölroll. Du kan därför exempelvis vara Ventilationsnisse, SvM-Pensionär, Geologisk Olycka och FOR KARL! samtidigt — arbetsmiljöavdelningen har informerats.

## Sätt upp Discord-boten

1. Skapa en Discord Application på https://discord.com/developers/applications och lägg till en Bot.
2. I **Installation**, välj `Guild Install`, scopes `bot` och `applications.commands`, samt bot-behörigheten **Manage Roles**.
3. Installera den på rätt server. Botens egen roll måste ligga **ovanför** samtliga roller den ska dela ut i Discords rollista.
4. Skapa de 15 rollerna ovan på servern. Slå på Developer Mode i Discord och kopiera varje roll-ID.
5. Publicera workern och ställ in Interactions Endpoint URL till:
   `https://DIN-WORKER.workers.dev/interactions`
6. Registrera slash-kommandot `/roles` via Discord API. Exempel med `APPLICATION_ID` och en bot-token i miljön:

```sh
curl -X POST "https://discord.com/api/v10/applications/$APPLICATION_ID/commands" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"roles","description":"Öppna Third Echelon-rollterminalen"}'
```

## RSVP, fasta lag och minnesbot

Fasta lag:

- 🟢 Kakan + LogiMOX
- 🔵 Bjestavs + Doxos

Nya slashkommandon:

- `/välkommen` — publicerar en humoristisk introduktion för Kakan, LogiMOX, Bjestavs och Doxos samt en snabb kommandoguide.
- `/rsvp` — publicerar en panel med **Jag är med**, **Sen** och **Kan inte** för nästa match.
- `/stats` — visar lagens vinster, RSVP-svar och senaste minnet.
- `/resultat vinnare:<lag>` — registrerar en vinst för ett av de fasta lagen.
- `/minne text:<text>` — sparar ett kort GubbSplinta-minne. De 20 senaste sparas.

RSVP, vinster och minnen lagras i Cloudflare KV-namnområdet `GUBBSPLINTA_STATE`.

Registrera de nya kommandona med en bot-token endast i din egen terminal:

```sh
read -s DISCORD_BOT_TOKEN
printf '\n'
DISCORD_BOT_TOKEN="$DISCORD_BOT_TOKEN" node register-commands.mjs
unset DISCORD_BOT_TOKEN
```

Starta om Discord/Vesktop eller vänta några minuter om kommandona inte syns direkt.

## Frånvaro via webbplatsen

Webbpanelen använder samma Cloudflare KV-data som Discord. Alla fyra räknas som **tillgängliga** tills de uttryckligen bokar av nästa matchdatum.

Inloggning:

- **Discord OAuth**: Lägg till redirect-URL:n `https://gubbsplinta-discord-proxy.gubbsplinta.workers.dev/auth/discord/callback` i Discord Developer Portal → OAuth2 → Redirects. Skapa därefter en OAuth2 Client Secret och spara den utan att dela den i chatten:

```sh
npx wrangler secret put DISCORD_OAUTH_CLIENT_SECRET
```

- **Privat snabb-länk**: Kör nedan efter deploy. Det skapar en unik länk per spelare och skriver bara länkar lokalt i terminalen. Skicka respektive länk privat; den fungerar som inloggning och kan återkallas i Cloudflare KV.

```sh
node create-magic-links.mjs
```

## Cloudflare-secrets och variabler

Hemligheter (skriv aldrig in dessa i `wrangler.toml`):

```sh
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
# Behövs även av den befintliga /post-maps-funktionen:
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put GITHUB_TOKEN
```

Roll-ID:n ska vara Worker variables. Ersätt exempelvärdena innan deployment:

```sh
npx wrangler secret put ROLE_SPIES_ID
npx wrangler secret put ROLE_MERCS_ID
npx wrangler secret put ROLE_DOUBLE_AGENT_ID
npx wrangler secret put ROLE_FISHER_FANCLUB_ID
npx wrangler secret put ROLE_CHAOS_ID
npx wrangler secret put ROLE_VERSUS_ID
npx wrangler secret put ROLE_SVM_VETERAN_ID
npx wrangler secret put ROLE_SCOUT_ID
npx wrangler secret put ROLE_GUNNER_ID
npx wrangler secret put ROLE_DRILLER_ID
npx wrangler secret put ROLE_ENGINEER_ID
npx wrangler secret put ROLE_FOR_KARL_ID
npx wrangler secret put ROLE_ROCK_AND_STONE_ID
npx wrangler secret put ROLE_MOLLY_UNION_ID
npx wrangler secret put ROLE_LEAF_LOVERS_ID
```

`wrangler secret put` används även för roll-ID:n här för att undvika att oavsiktligt publicera servermetadata. Koden kräver att alla 15 är satta.

Deploy:

```sh
npx wrangler deploy
```

## Test

```sh
node --test test-worker.mjs
npx wrangler deploy --dry-run
```

Ingen deploy har körts automatiskt: bot-token, Discord public key och roll-ID:n saknas lokalt.
