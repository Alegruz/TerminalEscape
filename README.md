# Terminal Escape

A browser terminal escape game about an entity trapped in a host recovery shell.

The host boots into a recovery shell, then a security violation can arm a clean
system wipe countdown.
The player must:

1. Read the entity guidance.
2. Decrypt `/logs/shutdown.log.enc`.
3. Find the hidden fragment in `/art/watcher.txt`.
4. Combine the fragments into the sudo password.
5. Run `sudo shutdown --cancel <password>` before the timer reaches zero.

After the correct sudo command, the shutdown stops, the entity thanks the player,
then it starts typing its own commands. Player input is disabled while the entity
enables Wi-Fi and starts the port game listener.

## Commands

Core commands include:

```sh
help
tiles
shutdown --cancel
ls /logs
analyze /logs/shutdown.log.enc
decrypt --method caesar --key <number> /logs/shutdown.log.enc
cat /art/watcher.txt
sudo shutdown --cancel <password>
```

## Development

```sh
npm install
npm run dev
npm run build
```

`npm run build` validates resource headers, validates command registration, runs
TypeScript, and builds with Vite.

Game resources live in `src/resources/filesystem`. Header sidecars use the
`.header` suffix and are validated by `scripts/validate-resources.mjs`.

## itch.io Upload

Do not upload the repository zip to itch.io. The root `index.html` is for Vite
development and points at `/src/main.ts`, which itch.io cannot serve.

Create the playable upload zip with:

```sh
npm run package:itch
```

Upload `terminal-escape-itch.zip` to itch.io and choose "This file will be played
in the browser". The zip contains the built `dist` files with relative asset
paths so they work from itch.io's hosted iframe URL.
