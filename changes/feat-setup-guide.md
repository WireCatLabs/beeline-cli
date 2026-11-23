### Added

- **`beeline <profile> setup` walks through the sign-in step by step, in English, Russian and Spanish.** What you
  need first (the Cloud PBX cabinet login, the paid «Интеграция по API» service, recorded calls), where the token
  is (<https://cloudpbx.beeline.ru/>, «Услуги» → «Интеграции» → «Интеграция по API», «Создать токен»), then the
  token field. The token is checked with Beeline as `session start` checks it, and kept only if Beeline accepts it.
  WireCat Desktop draws the same steps once it asks beeline for its flow.

### Fixed

- **The menu path to the token now names the «Интеграции» section** in the README, the sign-in text and the
  `session start` help: «Услуги» → «Интеграции» → «Интеграция по API».
- **cli-core 0.691.0.** Its `setup apply --dry-run` with no answers on stdin checks nothing and opens no keyring,
  as WireCat Desktop's check of a step expects.
