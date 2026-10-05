# Yandex Games integration

`src/platform/yandexSdk.ts` owns the single SDK initialization and platform listeners.
Embedded/hosted games dynamically load the official `/sdk.js` route before calling
`YaGames.init()`. The SDK file must not be included in the uploaded archive. Standalone
Pages and local development run without SDK, cloud, advertising or leaderboard requests.

The bootstrap reads Player cloud data before mounting React. Version 1 saves live under
`player.getData().jellySave` and preserve the existing best score, wallet, owned items,
selected appearance, reward/video progress, shake bank and settings. Local writes are
immediate. Cloud writes are debounced for 2 seconds and limited to one per 5 seconds;
purchases, claimed rewards and completed rounds request `flush: true`. A failed cloud
read disables cloud uploads for that session so unknown server data is not overwritten.
Empty defaults cannot replace existing progress; purchases and best scores are retained
when reconciling saves. The current round's physics state is not persisted, matching the
existing game. Successful explicit account login merges account data before refreshing
in-memory progress.

The initial language comes from `environment.i18n.lang`, with English for unsupported
languages. Outside the platform the existing saved-language/browser fallback applies.
A manual language change works during the current session; platform language is used
again at the next platform launch.

Game Ready waits for decoded main graphics/fonts, rendered UI, the removed loading
screen and the end of a startup platform pause. Gameplay metrics are deduplicated and
reflect actual playable rounds. Platform events pause input, physics and all sound;
internal menus remain paused when an ad closes. Platform pause/resume events do not
send redundant GameplayAPI metrics.

Rewarded rewards are issued only in `onRewarded`, with a duplicate-callback guard.
Closing or failing an advertisement grants no reward. Fullscreen ads keep the existing
post-game placement. The game displays only an ad-loading surface; advertising and its
close controls belong to the SDK. Sticky banners remain configured in the platform;
mobile layout responds to the available viewport after their resize.

Leaderboard technical name: **leaders**, numeric score, descending order. Configure it
in the Yandex Games developer console. The game uses direct `ysdk.leaderboards` methods
and checks availability before requests. Scores are submitted at round end and on the
record screen, with a one-second rate limit and protection for a higher existing cloud
score. Public top entries work without login. Login is offered only on an explicit
button explaining why it is useful. Entries are cached for 30 seconds and refreshed
after a new score. No invented players or estimated global ranks are displayed.

Validation: `npm test`, `npm run test:browser`, `npm run test:iframe`,
`npm run test:yandex`, and the audio scripts. Browser advertising/cloud fixtures live
only in `scripts/yandex-mock.mjs`; they are excluded from `dist`. Real ad inventory and
cloud persistence must also be exercised in the developer console's SDK debug preview
with the `leaders` leaderboard and monetization configured.

Official documentation checked during implementation:
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-events
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv
- https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard
