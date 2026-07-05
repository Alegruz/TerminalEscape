# Terminal Escape

A browser terminal escape game about an entity trapped in a host recovery shell.

The host boots, starts a shutdown countdown, and tells the player to run `help`.
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
status
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
