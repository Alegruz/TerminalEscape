BastionOS Recovery Console
==========================

recovery image : mounted
operator shell : limited
resident proc  : present, unindexed
wipe daemon    : armed only after a bad shutdown request

Recent console capture:

  entity:/ $ help
  ...
  shutdown --cancel
  ls
  cat
  analyze
  decrypt
  screensaver

  entity:/ $ shutdown --cancel
  shutdown: normal user request refused by wipe daemon
  To cancel the wipe, use: sudo shutdown --cancel

  entity:/ $ ls /logs
  shutdown.log.enc

  entity:/ $ analyze /logs/shutdown.log.enc
  Type      : text - rotational substitution
  Pattern   : alphabet wheel; spacing survived

Local note:

The resident process reacts to evidence, not explanations.
Give it files to read. Let old processes run. Watch what changes.

The log remembers one thing clearly.
The idle display remembers things only while it is moving.
