BastionOS Recovery Console
==========================

Wipe status     : IDLE
Resident status : NOT INDEXED
Root action     : sudo shutdown --cancel

This recovery console exposes local diagnostics, files, and one bundled game.
If clean system wipe begins, only sudo can cancel it.

Internal notes say privileged recovery depends on two local traces:
  - one trace is inside an encrypted shutdown log
  - one trace is referenced by a riddle in that log

Useful commands:
  help
  tiles
  shutdown --cancel
  ls /logs
  analyze /logs/shutdown.log.enc
  decrypt --method caesar --key <number> /logs/shutdown.log.enc
  screensaver

Combine the traces in the order you find them, then pass the result to sudo
if the host asks for privileged recovery.
