### Fixed

- **A call's client number is read as a Russian number.** Beeline gives the 10-digit national number, and the sync
  wrote it as `+9…`, so a call never linked to its CRM contact and its title showed the wrong number. It is now
  `+7…`; an extension or a foreign number keeps its digits as Beeline gave them.
