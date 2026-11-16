---
title: First calls as dialogues
goal: Copy the recorded calls from the PBX, transcribe them on this computer and read one as a dialogue.
steps:
  - run: beeline work session start
    why: work names this profile; paste the API token from the Beeline cabinet, checked against the PBX and kept in the keyring
  - run: beeline work meetings sync
    why: copies the recorded calls of the last 30 days into the local store; the next sync asks only for what is new
  - run: beeline models download gigaam-v3
    why: the local speech model, once; calls never leave this computer to be transcribed
  - run: beeline work meetings transcribe
    why: turns up to 20 new calls of five seconds or more into manager and client dialogues
  - run: beeline work meetings list 'duration_ms>=60000'
    why: the calls of a minute or more, newest first, from the store, offline too
  - run: beeline work meetings transcript 1
    why: one call as a dialogue; 1 stands for a meeting id from the list
look:
  - remaining in the sync answer, the calls a sync stopped before; run it again to go on
  - failed and remaining in the transcribe answer, the calls it could not transcribe and those left for the next run
---

A PBX records a call only when recording is turned on for that manager, so a manager with no calls may simply not
be recorded.
