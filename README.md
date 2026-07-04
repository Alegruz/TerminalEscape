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
npm run validate:resources
npm run validate:commands
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
| `file <path>` | Identify a file or directory |
| `head [-n count] <file>` | Print the first lines of a file |
| `tail [-n count] <file>` | Print the last lines of a file |
| `grep <pattern> <file>` | Search for text inside a file |
| `strings <file>` | Print printable strings from a file |
| `analyze <file>` | Cipher analysis and recommendations |
| `decrypt --method caesar --key N <file>` | Decrypt a Caesar-encoded file |
| `auth <system> <code>` | Authenticate against a restricted subsystem |
| `scan <target>` | Scan an unlocked component for repair faults |
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
  resources/
    filesystem/           In-game files mounted into the terminal
  game/
    Game.ts               Top-level game controller
    GameState.ts          Mutable game state (path, history, flags)
  fs/
    Path.ts               Path utilities (normalize, resolve, etc.)
    AccessControl.ts      Shared file access checks
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
    file.ts               file
    head.ts               head / tail
    grep.ts               grep
    strings.ts            strings
    analyze.ts            analyze
    decrypt.ts            decrypt
    auth.ts               auth
    scan.ts               scan
    repair.ts             repair
```

---

## How the app works

Terminal Escape is a static browser app with a small game loop around a terminal
simulation.

Startup flow:

1. [main.ts](src/main.ts) creates `Game` and calls `game.init()`.
2. [Game.ts](src/game/Game.ts) creates the core services:
   - `GameState` for mutable progress flags, current path, history, and timer state.
   - `VirtualFileSystem` for mounted resource files and sidecar headers.
   - `PuzzleRegistry` for puzzle metadata discovered from file headers.
   - `TerminalBuffer` for output history.
   - `TerminalRenderer` for PixiJS drawing.
   - `CommandRegistry` for command dispatch.
   - `InputController` for keyboard input.
3. `Game.registerCommands()` calls the command manifest, which registers all
   terminal commands, aliases, completion metadata, and option metadata.
4. `Game.runBootSequence()` pushes boot lines into `TerminalBuffer` using timed
   `setTimeout` calls.
5. When boot completes, the game enters `stage = 'play'`, enables input, starts
   the impact timer, and renders the live prompt.

Input event flow:

1. [InputController.ts](src/terminal/InputController.ts) listens to browser
   `keydown` events.
2. Printable keys edit the current input string. Enter sends the input to
   `Game.onSubmit()`. Tab sends the input to `Game.onTab()`.
3. `Game.onSubmit()` echoes the command, parses it with
   [CommandParser.ts](src/terminal/CommandParser.ts), then dispatches through
   [CommandRegistry.ts](src/terminal/CommandRegistry.ts).
4. Command handlers in `src/commands/` receive `CommandContext`, mutate
   `GameState` when needed, and return `OutputLine[]`.
5. `Game` appends those output lines to `TerminalBuffer` and calls
   `refreshDisplay()`.

Render/timer flow:

1. `Game.refreshDisplay()` selects a scrollback window from `TerminalBuffer`.
2. It calls `TerminalRenderer.render(...)` with visible output, input text,
   cursor position, live system status, and prompt text.
3. [TerminalRenderer.ts](src/terminal/TerminalRenderer.ts) stores pending render
   state. Its Pixi ticker repaints when dirty, blinks the cursor, and redraws
   chrome when the screen size changes.
4. The mission timer in `Game.updateMissionTimer()` runs every second while
   `stage === 'play'`. It updates the live countdown, emits threshold diagnostic
   events, and moves the game to `failed` if time reaches zero.

Resource flow:

1. [filesystem.ts](src/data/filesystem.ts) imports `src/resources/filesystem/**/*`
   through Vite as raw text.
2. Files ending in `.header` are parsed as developer metadata and attached to the
   matching visible file.
3. Header files are hidden from `ls`, autocomplete, and player file reads.
4. [ResourceValidation.ts](src/data/ResourceValidation.ts) validates header
   structure at runtime. `scripts/validate-resources.mjs` validates the same
   resource folder before build.

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
puzzleId: emergency_broadcast
cipher: caesar
key: 13
answerCode: EXAMPLE-CODE
solveFlag: emergencyDecrypted
scanFlag: navScanned
scanMessage: checksum mismatch isolated in trajectory correction table
repairFlag: navRepaired
repairRequiresFlag: navScanned
repairAlias: nav
repairDenied: authorization required before repair routines can run
repairComplete: true
hidden: false
```

### Resource validation

Run resource assertions directly with:

```bash
npm run validate:resources
```

`npm run build` runs resource and command validation before TypeScript and Vite.
In the browser, resource assertion failures render a fatal developer screen
instead of silently starting with broken content.

## Adding new puzzles

Use this section when adding either a new instance of an existing puzzle type or
a completely new puzzle mechanic.

### Puzzle system map

| Layer | Current files/classes | What belongs here |
|---|---|---|
| In-world content | `src/resources/filesystem/**` | Player-visible logs, encrypted files, modules, notes, patch data |
| Hidden metadata | `*.header` sidecars | Access gates, puzzle IDs, solve flags, repair flags, scan metadata |
| Header schema | `src/data/filesystem.ts` | TypeScript types for allowed metadata fields |
| Header validation | `src/data/ResourceValidation.ts`, `scripts/validate-resources.mjs` | Developer assertions for bad metadata |
| Player state | `src/game/GameState.ts` | Boolean progress flags and runtime state |
| Diagnostics | `src/data/diagnostics.ts` | Ship system states, timer events, state-driven diagnostic text |
| VFS behavior | `src/fs/VirtualFileSystem.ts`, `src/fs/AccessControl.ts` | File lookup, hidden headers, access checks |
| Puzzle algorithms | `src/puzzles/crypto.ts`, `src/puzzles/PuzzleRegistry.ts` | Cipher/decoder/checking logic discovered from headers |
| Commands | `src/commands/*.ts` | Player actions such as analyze, decrypt, auth, scan, repair |
| Command routing | `src/commands/CommandManifest.ts` | Command registration, handler binding, aliases, validation |
| Help/autocomplete | `src/commands/CommandCatalog.ts`, `src/terminal/Autocomplete.ts` | Player-facing command documentation and Tab behavior |

### Add an instance of an existing puzzle type

1. Add player-visible resource files under `src/resources/filesystem/`.
   For example, add an encrypted file, notes, logs, broken modules, or patch files.
2. Add a `.header` sidecar for metadata that should not be player-visible.
   Puzzle headers currently support:

```text
puzzleId: unique_puzzle_id
cipher: caesar
key: 13
answerCode: EXAMPLE-CODE
solveFlag: emergencyDecrypted
hidden: false
```

3. If the puzzle gates file access, add access metadata to the target file:

```text
accessFlag: navUnlocked
accessDenied: authorization required by navigation subsystem
```

4. If the puzzle unlocks a repair step, add scan/repair metadata:

```text
scanFlag: navScanned
scanMessage: checksum mismatch isolated in trajectory correction table
repairFlag: navRepaired
repairRequiresFlag: navScanned
repairAlias: nav
repairDenied: authorization required before repair routines can run
repairComplete: true
```

5. Add any new state flags to:
   - `FSStateFlag` in [filesystem.ts](src/data/filesystem.ts)
   - `GameState.flags` in [GameState.ts](src/game/GameState.ts)
6. If the puzzle affects ship diagnostics, update
   [diagnostics.ts](src/data/diagnostics.ts). Use `unlockedWhen` and
   `repairedWhen` to connect diagnostics to state flags.
7. If the puzzle needs a new cipher, implement the algorithm in
   [crypto.ts](src/puzzles/crypto.ts), update `PuzzleRegistry.decrypt()`, and
   add completion/help metadata for any new command options.
8. If the puzzle needs a new terminal command:
   - Add a handler in `src/commands/`.
   - Add metadata in [CommandCatalog.ts](src/commands/CommandCatalog.ts).
   - Bind the handler in [CommandManifest.ts](src/commands/CommandManifest.ts).
   - Let help and autocomplete read from the catalog.
9. Run:

```bash
npm run validate:resources
npm run validate:commands
npm run build
```

### Add a new puzzle mechanic

Use this audit path when the puzzle is not just another Caesar-encrypted file.
Examples: retrieving a password from several files, validating a checksum,
assembling a patch from fragments, repairing a library/executable, routing power,
or decoding a custom data format.

1. Define the player action loop first.

Write down the intended loop in terminal verbs:

```text
discover -> inspect -> transform/decode -> authenticate/unlock -> scan -> repair
```

Then decide whether existing commands can express it. Prefer reusing terminal
verbs (`cat`, `file`, `strings`, `grep`, `analyze`, `auth`, `scan`, `repair`)
before adding a new command.

2. Audit whether the puzzle needs new state.

Add a flag when the game must remember progress:

```ts
// src/game/GameState.ts
flags = {
  foundPassword: false,
  decodedPayload: false,
  modulePatched: false,
};
```

Then add the same flag to `FSStateFlag` in `src/data/filesystem.ts` if headers
need to reference it.

3. Extend header metadata only when content needs to drive behavior.

If designers should configure the puzzle from resources, add fields to:

- `FSFileHeader` in `src/data/filesystem.ts`
- `VALID_HEADER_FIELDS` and parsing in `src/data/ResourceValidation.ts`
- `VALID_HEADER_FIELDS` and parsing in `scripts/validate-resources.mjs`
- README header examples

Examples of possible new metadata:

```text
passwordFlag: foundPassword
passwordValue: <redacted or encoded value>
patchRequiresFlag: decodedPayload
patchOutputFlag: modulePatched
checksum: 3F9A
format: nav-patch-v1
```

Do not add metadata fields “just in case.” Add them when they remove hardcoded
logic from commands or allow designers to author content safely.

4. Add validation before adding gameplay logic.

Every new header field should have assertions. Examples:

- A `patchRequiresFlag` must reference a known state flag.
- A `patchOutputFlag` must be present if `format: patch` is present.
- A file that declares `passwordValue` must also declare `passwordFlag`.
- Duplicate aliases, IDs, routes, or targets should fail validation.
- Invalid enum values should produce an actionable error.

Run `npm run validate:resources` and `npm run validate:commands` while
developing. Bad content or command definitions should fail fast for developers,
not become silent player bugs.

5. Decide whether the mechanic belongs in an existing command or a new command.

Use existing commands when the action is generic:

| Mechanic | Usually belongs in |
|---|---|
| Read or inspect file text | `cat`, `head`, `tail`, `strings`, `grep` |
| Identify file type or restrictions | `file` |
| Detect cipher/data shape | `analyze` |
| Decrypt/decode with method/key | `decrypt` or a new decoder command |
| Authenticate with recovered material | `auth` |
| Inspect damaged component | `scan` |
| Apply final system fix | `repair` |

Add a new command when the verb is materially different. For example:

| New mechanic | Possible command |
|---|---|
| Assemble fragments | `assemble <output> <parts...>` |
| Verify a checksum | `verify <file>` |
| Apply a patch file | `patch <target> --with <file>` |
| Mount a recovered archive | `mount <image>` |
| Route power between systems | `route <source> <target>` |

When adding a command:

- Create `src/commands/<name>.ts`.
- Use `CommandContext` for `state`, `vfs`, `puzzles`, and `buffer`.
- Return `OutputLine[]`; do not render directly.
- Add metadata in `src/commands/CommandCatalog.ts`.
- Bind the handler in `src/commands/CommandManifest.ts`.
- Reuse `checkFileAccess()` for file access restrictions.

6. Add or extend puzzle algorithms.

For cryptography/data transforms:

- Put pure algorithms in `src/puzzles/crypto.ts` or a new focused file under
  `src/puzzles/`.
- Keep command parsing and terminal output in `src/commands/`.
- Keep puzzle discovery/checking in `PuzzleRegistry`.

If a new cipher is configured from headers:

- Extend `FSFileHeader.cipher`.
- Validate the new cipher value in both validators.
- Extend `PuzzleRegistry.decrypt()`.
- Update command autocomplete for `decrypt --method`.
- Update `analyze` only if it can reasonably detect the new format.

7. Connect the mechanic to diagnostics.

If the puzzle repairs or changes the ship:

- Add or update systems in `src/data/diagnostics.ts`.
- Use `unlockedWhen` for intermediate access states.
- Use `repairedWhen` for final fixed states.
- Add timer events only if the system should affect urgency.

8. Keep player-facing docs spoiler-free.

Do not put exact answers, keys, solved command chains, or access codes in
`README.md` or generic command help. Put discoverable information in in-game
resources instead.

9. Build the audit checklist into the PR/review.

Before merging a new puzzle, check:

- `npm run validate:resources` passes.
- `npm run validate:commands` passes.
- `npm run build` passes.
- New headers have validation coverage.
- New state flags are used by diagnostics or commands.
- New commands have catalog help and autocomplete metadata.
- File access checks use `checkFileAccess()`.
- README remains spoiler-free.
- There is a playable path from discovery to resolution.

### Puzzle ownership quick reference

| Need | Work in |
|---|---|
| Add readable/in-world files | `src/resources/filesystem/` |
| Add hidden metadata | `*.header` sidecar |
| Add/validate header fields | `src/data/ResourceValidation.ts`, `src/data/filesystem.ts` |
| Add player state | `src/game/GameState.ts` |
| Change diagnostics/timer text | `src/data/diagnostics.ts` |
| Add command behavior | `src/commands/`, then `src/commands/CommandManifest.ts` |
| Add command autocomplete | `src/commands/CommandCatalog.ts` |
| Add cipher logic | `src/puzzles/crypto.ts`, `src/puzzles/PuzzleRegistry.ts` |

## Adding new commands

Commands are registered from one manifest so help text, autocomplete, aliases,
and handlers cannot drift apart.

Command system map:

| Layer | File | Purpose |
|---|---|---|
| Handler implementation | `src/commands/<name>.ts` | Executes command behavior and returns `OutputLine[]` |
| Command metadata | `src/commands/CommandCatalog.ts` | Name, description, usage, examples, completion metadata |
| Handler binding | `src/commands/CommandManifest.ts` | Maps catalog names to handlers and validates command definitions |
| Help output | `src/commands/help.ts` | Reads `COMMAND_CATALOG`; do not duplicate help text here |
| Dispatch/runtime help | `src/terminal/CommandRegistry.ts` | Executes commands and handles global `--help` / `-h` |
| Autocomplete | `src/terminal/Autocomplete.ts` | Uses completion metadata from the registry |
| Registration call site | `Game.registerCommands()` | Calls `registerGameCommands(this.registry)` |

### Command implementation checklist

1. Create `src/commands/<name>.ts`.
2. Export a function with this shape:

```ts
export function myCommand(
  cmd: ParsedCommand,
  ctx: CommandContext,
): OutputLine[] {
  return [];
}
```

3. Use `CommandContext` instead of importing game singletons:
   - `ctx.state` for progress flags/current path/history state.
   - `ctx.vfs` for resolving, listing, and reading files.
   - `ctx.puzzles` for puzzle checks/transforms.
   - `ctx.buffer` only when the command needs direct buffer access.
4. Return `OutputLine[]`; never call renderer APIs from a command.
5. Use `out(text, color)` for command output.
6. For file arguments:
   - Resolve paths with `ctx.vfs.resolve(ctx.state.currentPath, input)`.
   - Check type with `getNodeType()`.
   - Use `checkFileAccess()` before reading restricted files.
7. Add a `COMMAND_CATALOG` entry in `src/commands/CommandCatalog.ts`.
8. Add the handler to `HANDLERS` in `src/commands/CommandManifest.ts`.
9. Add aliases to `COMMAND_ALIASES` only if the alias should be valid input.
10. Run `npm run build`.

### Command catalog requirements

Every command must define:

```ts
{
  name: 'command-name',
  description: 'Short help-list description.',
  usage: 'command-name <arg>',
  examples: ['command-name example'],
  completion: { args: 'path' },
}
```

Completion modes:

| Mode | Use when |
|---|---|
| `none` | The command takes no path/command argument |
| `path` | The command operates on files or directories |
| `command` | The command takes another command name, like `help` |

Options are declared in the same completion object:

```ts
completion: {
  args: 'path',
  options: [
    { name: '--method', values: ['caesar'], requiresValue: true },
    { name: '--key', requiresValue: true },
  ],
}
```

Do not add `--help` or `-h` to command options. `CommandRegistry` provides both
globally for every registered command.

### Dev-only commands

Commands can set `devOnly: true` in `COMMAND_CATALOG`. Dev-only commands are
validated with the rest of the command manifest, but `CommandManifest` only
registers them when `import.meta.env.DEV` is true. They are hidden commands:
`help`, `help <command>`, and Tab completion must not reveal them.

Current dev commands:

| Command | Purpose |
|---|---|
| `dev-fx [seconds] [intensity]` | Trigger terminal shake/glitch rendering without waiting for the timer |
| `dev-speed <multiplier>` | Speed up or slow down the mission timer for testing |

Do not use dev-only commands for puzzle progression. They should exercise
debugging hooks, renderer states, timers, and developer assertions only.

### Command validation

`validateCommandManifest()` runs when commands are registered, and
`npm run validate:commands` runs the same command contract before a production
build. Validation fails fast if:

- A command name is duplicated.
- A command name is not shell-safe lowercase.
- A command is missing description, usage, examples, or completion metadata.
- A catalog entry has no handler.
- A handler has no catalog entry.
- An alias conflicts with a command name.
- An alias points to an unknown command.
- A command tries to manually declare `--help` or `-h`.
- The `help` command is missing.

In development, these errors appear as a fatal browser assertion screen. During
build, `scripts/validate-commands.mjs` catches catalog/manifest drift before
TypeScript and Vite run.

### Command design rules

- Prefer general terminal verbs over game-specific verbs.
- Keep command names short, lowercase, and shell-like.
- Avoid hidden valid commands. If an alias is valid, document why it exists.
- Keep generic help spoiler-free. Put puzzle clues in in-game files.
- If a command changes game state, make that state explicit in `GameState.flags`.
- If a command reads a file, respect VFS headers and access rules.
- If a command needs autocomplete, express it through catalog metadata instead of
  editing `Autocomplete.ts` directly.

## Working with rendering

Rendering is intentionally isolated from game logic. Most renderer changes should
stay inside [TerminalRenderer.ts](src/terminal/TerminalRenderer.ts) and
[theme.ts](src/style/theme.ts).

Renderer responsibilities:

| Responsibility | File/class/function |
|---|---|
| Create Pixi app and canvas | `TerminalRenderer.init()` |
| Build display objects | `TerminalRenderer.buildSceneGraph()` |
| Draw border/chrome | `drawBorder()`, `refreshChrome()` |
| Draw scanlines/vignette | `buildScanlines()` |
| Store pending render state | `render(...)` |
| Paint text/cursor | `repaint()` |
| Cursor blink and resize polling | `tick(...)` |
| Text colors, spacing, padding | `src/style/theme.ts` |
| Body/canvas/fatal-error CSS | `src/style.css` |

Rules of thumb:

- Do not read or mutate `GameState` from the renderer. Pass render-ready strings
  and lines from `Game.refreshDisplay()`.
- Keep Pixi display objects persistent. Create them once in `buildSceneGraph()`
  and update their text/position in `repaint()`.
- Use `markDirty()` after any renderer state changes. The Pixi ticker performs
  the actual repaint.
- For resize-sensitive chrome, update through `refreshChrome()`. It is called
  after browser resize and when the Pixi screen size changes in `tick()`.
- The input prompt and live system row are fixed at the bottom. Only
  `TerminalBuffer` output scrolls.
- Cursor X position uses `CanvasTextMetrics.measureText(...)`; avoid returning
  to character-count math unless all text rendering is truly fixed-width.
- Add new colors to `theme.ts` and `colorForType()` before using new
  `TextColor` values.
- Keep renderer code presentation-only. If behavior depends on commands,
  puzzles, file access, or diagnostics, implement it in `Game`, `commands`,
  `VirtualFileSystem`, or data modules first.

Rendering change checklist:

1. Identify whether the change is style, layout, chrome, input, or output.
2. Update `theme.ts` for colors/sizes, `TerminalRenderer.ts` for Pixi objects,
   or `style.css` for page-level CSS.
3. Test resize/minimize/restore behavior when touching border, scanlines, or
   layout.
4. Test long command input and cursor placement when touching prompt or text
   measurement.
5. Run `npm run build`.

---

## Known limitations

- Single timed cryptography puzzle in the current vertical slice.
- Scroll-back is limited to the terminal buffer history.
- No sound effects.
- Desktop browsers only (keyboard-first design).

---

## License

MIT
