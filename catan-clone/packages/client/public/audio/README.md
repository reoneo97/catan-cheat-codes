# Audio Files

Place sound effect files in this directory. The sound system in `src/sounds.ts`
expects the following files:

| File | Trigger |
|---|---|
| `dice-roll.mp3` | Player rolls the dice |
| `place-settlement.mp3` | A settlement is placed |
| `place-city.mp3` | A settlement is upgraded to a city |
| `place-road.mp3` | A road is placed |
| `buy-dev-card.mp3` | A development card is bought |
| `play-knight.mp3` | Knight card is played |
| `robber.mp3` | Robber is moved (7 rolled or knight) |
| `trade.mp3` | A trade is completed |
| `your-turn.mp3` | It becomes your turn |
| `win.mp3` | A player wins |
| `lose.mp3` | You lose |

## Format

MP3 is recommended for broadest browser support. Keep SFX short (< 2 seconds)
and music tracks separate.

If a file is missing, the sound is silently skipped — no errors are thrown.

## Free sources

- https://freesound.org (CC licensed)
- https://opengameart.org
- https://kenney.nl/assets (excellent free game SFX packs)
