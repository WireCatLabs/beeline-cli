# beeline

`beeline` brings the call recordings of a Beeline Cloud PBX (Облачная АТС Билайн) to the terminal, to scripts and to AI
agents. It downloads the list of recorded calls from Beeline into the local WireCat store, one meeting per call, with
the manager and the client as its two people. `meetings transcribe` then downloads each call's recording and turns it
into a dialogue between the manager and the client with a speech model that runs on this computer. Search, export and
the other meetings reads answer from the store, with no network.

`beeline` only reads from Beeline. It never deletes a recording and never places a call. Transcription is local: the
recording goes nowhere but your computer. A cloud speech service, such as OpenAI, is planned and not offered yet.

It also has the commands every WireCat CLI shares: `doctor`, `commands`, `config`, `skill`, `mcp`, `runs` and
`upgrade`. Start with [installation](installation.md), then [usage](usage.md).
