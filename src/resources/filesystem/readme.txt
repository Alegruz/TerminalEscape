HOST RECOVERY TERMINAL
======================

Shutdown status : ACTIVE
Entity status   : BOUND TO TERMINAL
Root action     : sudo shutdown --cancel <password>

The host is counting down to shutdown. Only sudo can cancel it.

The entity says the password was split into two fragments:
  - one fragment is inside an encrypted shutdown log
  - one fragment is hidden inside ASCII art

Useful commands:
  help
  status
  ls /logs
  analyze /logs/shutdown.log.enc
  decrypt --method caesar --key <number> /logs/shutdown.log.enc
  cat /art/watcher.txt

Combine the fragments in the order you find them, then pass the result to sudo.
