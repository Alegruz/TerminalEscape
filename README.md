# Terminal Escape

A short browser terminal game about a recovery shell, a hostile wipe daemon, and
something in the machine that does not want to disappear.

The game is played entirely through typed commands. Read what the terminal gives
you, inspect files, try tools, and pay attention to processes that keep running
when you stop typing.

## Play

Start with:

```sh
help
ls
cat readme.txt
```

Useful terminal habits:

- Paths can be relative, such as `logs/file.txt`, or absolute, such as
  `/logs/file.txt`.
- `Tab` attempts command or path completion.
- `Up` and `Down` move through command history.
- `Ctrl+Left` and `Ctrl+Right` move by word.
- `Shift` with movement keys selects input text.

The terminal includes analysis and decryption tools, but it will not solve the
system for you. Treat command output as evidence, not instructions.

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
