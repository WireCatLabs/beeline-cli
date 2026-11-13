### Added

- **A sync links each call's client to the Bitrix24 contact with the same phone number.** The client's number is kept
  as its E.164 phone, and cli-core 0.651.0 links the callers a sync saved by the phone rule alone. A mobile number that
  only the client and one contact hold links at once; a landline only proposes the link. With `b24` on the same store
  and both accounts in the `work` scope, the calls show in `b24`'s `deals show` and `leads show` and in a person's
  context, in the field `meetings`. Calls synced before this version link once a sync saves them again:
  `meetings sync --rescan` for the last 30 days, `--since-time` for older ones
  ([README](../README.md#what-you-can-do)).

### Changed — may break callers

- **A call's client is the identity `phone:+<number>`, with the `+`.** A store that holds calls synced before this
  version keeps their old client rows beside the new ones once a sync saves those calls again.
