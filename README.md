# Terminal Escape — ARES-7

A browser-based terminal cryptography puzzle game built for an itch.io game jam.

You are stranded aboard the damaged spaceship **ARES-7**.  Navigation is offline.
Explore a fake Linux-like terminal, read encrypted emergency logs, crack the cipher,
and escape.

---

## Tech stack

| Technology | Purpose |
|---|---|
| TypeScript | Main language |
| Vite | Build tool |
| PixiJS v8 | Custom canvas-rendered terminal UI |

No backend required — the entire game runs in the browser as a static HTML5 site.

---

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Building for itch.io

```bash
npm run build
```

Upload the contents of the `dist/` folder as an **HTML5** game on itch.io.
Set the game frame to at least **900 × 540** pixels.

---

## How to play

Boot sequence plays automatically.  After boot, type commands at the prompt.

### Quick walkthrough

```
help                                       # list commands
status                                     # current objective
ls                                         # list files
cat readme.txt                             # read the readme
cd logs                                    # enter logs directory
cat crew_note.txt                          # read the hint
analyze emergency.enc                      # identify the cipher
decrypt --method caesar --key 13 emergency.enc   # decrypt it!
submit NOVA-7734                           # restore navigation & escape
```

### Implemented commands

| Command | Description |
|---|---|
| `help` | List available commands |
| `help <cmd>` / `<cmd> --help` | Show usage for a command |
| `ls [path]` | List directory contents |
| `cd <path>` | Change directory (supports `..` and absolute paths) |
| `pwd` | Print current directory |
| `cat <file>` / `open <file>` | Display file contents |
| `clear` | Clear the terminal |
| `status` | Show current objective + suggested commands |
| `analyze <file>` | Cipher analysis and recommendations |
| `decrypt --method caesar --key N <file>` | Decrypt a Caesar-encoded file |
| `submit <code>` | Submit the navigation access code |

### Navigation shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate command history |
| `Tab` | Autocomplete command names and file paths |
| `←` / `→` | Move cursor within input |
| `Home` / `End` | Jump to start / end of line |

---

## Project structure

```
src/
  main.ts                 Entry point
  style.css               Minimal body/canvas CSS
  style/
    theme.ts              Colour palette and font constants
  data/
    filesystem.ts         Virtual filesystem data (all files/dirs)
    puzzles.ts            Puzzle metadata (cipher type, key, answer)
  game/
    Game.ts               Top-level game controller
    GameState.ts          Mutable game state (path, history, flags)
  fs/
    Path.ts               Path utilities (normalize, resolve, etc.)
    VirtualFileSystem.ts  VFS wrapper around the data
  puzzles/
    crypto.ts             Caesar cipher implementation
    PuzzleRegistry.ts     Puzzle lookup and validation
  terminal/
    TerminalBuffer.ts     Buffer of coloured text lines
    TerminalRenderer.ts   PixiJS canvas renderer
    CommandParser.ts      Parses raw input → ParsedCommand
    CommandRegistry.ts    Maps command names to handlers
    Autocomplete.ts       Tab-completion logic
    InputController.ts    Keyboard input handling
  commands/
    help.ts               help
    ls.ts                 ls
    cd.ts                 cd
    pwd.ts                pwd
    cat.ts                cat / open
    clear.ts              clear
    status.ts             status
    analyze.ts            analyze
    decrypt.ts            decrypt
    submit.ts             submit
```

---

## Adding new files / directories

Edit `src/data/filesystem.ts`.  Add entries to the `children` map of any `FSDir` node:

```ts
'my_file.txt': {
  type: 'file',
  content: 'Hello, space!\n',
},
'new_dir': {
  type: 'dir',
  children: {
    'nested.txt': { type: 'file', content: 'Nested file.\n' },
  },
},
```

## Adding new puzzles

1. Add a new entry to `src/data/puzzles.ts`.
2. Implement any new cipher methods in `src/puzzles/crypto.ts`.
3. Update `PuzzleRegistry.decrypt()` to dispatch to the new method.
4. Update the `status` command hints in `src/commands/status.ts`.

---

## Known limitations

- Single puzzle (Caesar/ROT13) in the current vertical slice.
- No scroll-back beyond the visible terminal window.
- No mouse support (keyboard only, by design).
- No sound effects.
- Desktop browsers only (keyboard-first design).

---

## License

MIT
