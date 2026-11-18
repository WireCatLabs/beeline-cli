### Fixed

- **WireCat Desktop can sign a beeline account out or remove it, and shows when the calls last synced.** The
  manifest now carries `accountRemove` (`session end`, and `account remove` keeping or deleting the calls) and the
  last-sync query of `meetings sync`, written by cli-base 0.119.0. It needs WireCat Desktop 0.7.3 or newer: an older
  Desktop refuses the manifest, so it cannot add or update beeline until it updates itself.
