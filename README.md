# Terminal Escape - ARES-7

A browser-based terminal cryptography puzzle game built for an itch.io game jam.

You are stranded aboard the damaged spaceship **ARES-7**.  Navigation is offline.
Explore a fake Linux-like terminal, read encrypted emergency logs, crack the cipher,
and restore navigation before the impact timer reaches zero.

---

## Start here

This project is a static browser game. You do not need a database, server account,
Docker, or any paid tools.

### Run it

Clone the project:

```bash
git clone https://github.com/Alegruz/TerminalEscape.git
cd TerminalEscape
```

Then run the launcher for your system:

Windows:

- Double-click `run.bat`, or
- From a terminal, run `.\run.bat`

```bash
# macOS / Linux
chmod +x ./run.sh
./run.sh
```

The launcher checks Node.js/npm, installs project dependencies, and starts the
local dev server. Open the URL it prints, usually:

```text
http://localhost:5173
```

Keep the launcher terminal open while you play or develop. Stop it with `Ctrl+C`.

### What the launcher handles

| It checks | What happens |
|---|---|
| Node.js | Requires `20.19.0+` or `22.12.0+`. On Windows, it tries to install Node.js LTS with `winget` if missing. |
| npm | Confirms npm is available after Node.js is installed. |
| dependencies | Runs `npm install` for you. |
| dev server | Runs `npm run dev` and prints the browser URL. |

If the launcher cannot install Node.js automatically, install Node.js 22 LTS from
<https://nodejs.org/>, open a new terminal, and run the launcher again.

### Manual commands

```bash
npm install
npm run dev
```

To verify a production build:

```bash
npm run build
```

### Common setup problems

| Problem | Fix |
|---|---|
| Double-clicking `run.ps1` does not work | Double-click `run.bat` instead. |
| PowerShell says script execution is disabled | Run `.\run.bat`; it handles the PowerShell setting for this launch. |
| `node` / `npm` is not recognized after installing Node.js | Close and reopen the terminal, then run the launcher again. |
| Browser says the site cannot be reached | Make sure the launcher is still running and use the exact URL it prints. |
| Port `5173` is already in use | Vite will print a different URL. Open that URL instead. |

The build output is written to `dist/`. The `node_modules/` and `dist/` folders
are local generated files and are intentionally not committed to git.

---

## Tech stack

| Technology | Purpose |
|---|---|
| TypeScript | Main language |
| Vite | Build tool |
| PixiJS v8 | Custom canvas-rendered terminal UI |

No backend required — the entire game runs in the browser as a static HTML5 site.

---

## Daily development commands

```bash
npm run dev      # start the local dev server
npm run build    # type-check and build production files into dist/
npm run preview  # preview the production build locally
```

There is no automated test suite yet. For now, use `npm run build` as the basic
verification step before sharing changes.

## Building for itch.io

```bash
npm run build
```

Upload the contents of the `dist/` folder as an **HTML5** game on itch.io.
Set the game frame to at least **900 × 540** pixels.

---

## How to play

Boot sequence plays automatically.  After boot, type commands at the prompt.
The mission timer starts when the terminal becomes ready.

### First steps

```
help                                       # list commands
status                                     # current ship diagnostics
ls                                         # list files
cat readme.txt                             # read the readme
```

The rest is intentionally not documented here. Use the in-game files,
diagnostics, and command help to work out the recovery sequence.

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
| `status` | Show current ship diagnostics |
| `analyze <file>` | Cipher analysis and recommendations |
| `decrypt --method caesar --key N <file>` | Decrypt a Caesar-encoded file |
| `submit <code>` | Submit an access code to unlock a restricted system |
| `repair <target>` | Repair an unlocked damaged system component |

### Navigation shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate command history |
| `Tab` | Autocomplete command names, options, option values, and file paths |
| Mouse wheel | Scroll terminal output |
| `PageUp` / `PageDown` | Scroll terminal output by one page |
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
    filesystem.ts         Builds the virtual filesystem from resource files
    diagnostics.ts        Ship systems, timer events, and diagnostic text
    puzzles.ts            Puzzle metadata (cipher type, key, answer)
  resources/
    filesystem/           In-game files mounted into the terminal
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

Add real files under `src/resources/filesystem/`. The folder structure maps directly
to the in-game terminal paths:

```text
src/resources/filesystem/readme.txt              -> /readme.txt
src/resources/filesystem/logs/crew_note.txt      -> /logs/crew_note.txt
src/resources/filesystem/systems/nav.locked      -> /systems/nav.locked
```

`src/data/filesystem.ts` loads that resource folder automatically during the Vite
build, so no TypeScript changes are needed for ordinary file or directory additions.

### File headers

Add optional sidecar files next to resources for metadata that should be visible to
developers but invisible to players:

```text
src/resources/filesystem/systems/nav_core.dat
src/resources/filesystem/systems/nav_core.dat.header
```

Header files are loaded by the VFS and are not listed or autocompleted in-game.
Supported fields:

```text
accessFlag: navUnlocked
accessDenied: authorization required by navigation subsystem
repairFlag: navRepaired
repairAlias: nav
repairDenied: authorization required before repair routines can run
repairComplete: true
hidden: false
```

## Adding new puzzles

1. Add a new entry to `src/data/puzzles.ts`.
2. Implement any new cipher methods in `src/puzzles/crypto.ts`.
3. Update `PuzzleRegistry.decrypt()` to dispatch to the new method.
4. Update `src/data/diagnostics.ts` if a puzzle changes ship system state or failure timing.

---

## Known limitations

- Single timed cryptography puzzle in the current vertical slice.
- Scroll-back is limited to the terminal buffer history.
- No sound effects.
- Desktop browsers only (keyboard-first design).

---

## License

MIT
