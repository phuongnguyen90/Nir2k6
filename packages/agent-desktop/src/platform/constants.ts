// Per-OS command and path constants, kept in one place so the adapters stay
// thin and the differences are easy to audit.

import type { Command } from "./run.js";

export const HOSTS_PATH = {
  linux: "/etc/hosts",
  macos: "/etc/hosts",
  windows: "C:\\Windows\\System32\\drivers\\etc\\hosts",
} as const;

export const LOCK_COMMANDS: {
  linux: Command[];
  macos: Command[];
  windows: Command[];
} = {
  linux: [
    { cmd: "loginctl", args: ["lock-session"] },
    { cmd: "xdg-screensaver", args: ["lock"] },
    { cmd: "gnome-screensaver-command", args: ["--lock"] },
    { cmd: "dm-tool", args: ["lock"] },
  ],
  macos: [
    { cmd: "pmset", args: ["displaysleepnow"] },
    {
      cmd: "/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession",
      args: ["-suspend"],
    },
  ],
  windows: [{ cmd: "rundll32.exe", args: ["user32.dll,LockWorkStation"] }],
};
