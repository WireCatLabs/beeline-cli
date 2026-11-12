---
title: First calls as dialogues
goal: Copy the recorded calls from the PBX, transcribe them on this computer and read one as a dialogue.
steps:
  - run: beeline session start
    why: paste the API token from the Beeline cabinet; it is checked against the PBX and kept in the keyring
  - run: beeline meetings sync
    why: copies the recorded calls of the last 30 days into the local store; the next sync asks only for what is new
  - run: beeline models download gigaam-v3
    why: the local speech model, once; calls never leave this computer to be transcribed
  - run: beeline meetings transcribe
    why: turns up to 20 new calls of five seconds or more into manager and client dialogues
  - run: beeline meetings list 'duration_ms>=60000'
    why: the calls of a minute or more, newest first, from the store, offline too
  - run: beeline meetings transcript 1
    why: one call as a dialogue; 1 stands for a meeting id from the list
look:
  - remaining in the sync answer, the calls a sync stopped before; run it again to go on
  - failed and remaining in the transcribe answer, the calls it could not transcribe and those left for the next run
---

A PBX records a call only when recording is turned on for that manager, so a manager with no calls may simply not
be recorded.
