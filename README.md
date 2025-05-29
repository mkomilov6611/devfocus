# DevFocus
A cross-platform CLI tool designed for developers to block distracting websites, enabling a distraction-free coding environment by modifying the system hosts file.

## Why Choose DevFocus CLI Over Other Apps/Extensions? 🚀
**Cost**
- *Others*: Costly subscriptions drain funds better spent on coding fuel. 💸
- *DevFocus*: Free via npm, saving your budget for that extra Espresso! ☕

**Block Limits**  
- *Others*: Limited site blocking lets distractions sneak through. 🕳️
- *DevFocus*: Unlimited blocks secure your focus like a locked repo! 🔐

**Interface**  
- *Others*: Complex GUIs make blocking a chore. 🥴
- *DevFocus*: Sleek CLI, as smooth as running `devfocus on` for instant focus! 😎

**Ads**  
- *Others*: Disruptive ads sabotage your productivity. 📣
- *DevFocus*: Ad-free, keeping your workspace clean as a fresh commit! ✨

**Dev Fit**  
- *Others*: Made for all, not only devs😕
- *DevFocus*: Dev-first, your terminal’s best pal for distraction-free coding! 🖱️

## Features
- **Block Websites**: Add websites to a block list to prevent access during coding sessions.
- **Focus Mode**: Toggle focus mode to block or unblock websites instantly (`on` or `off`).
- **Focus Mode Scheduled**: Specify hours to focus, and it will schedule the unblocking for you.
- **Cross-Platform**: Works on macOS, Linux, and Windows.
- **Developer-Friendly**: Simple commands to manage distractions, ideal for deep work and coding sprints.

## Installation

### Via npm
```bash
sudo npm install --location=global devfocus
```
Requires Node.js v16 or higher.

## Usage
Run commands with `sudo` on macOS/Linux or as Administrator on Windows for commands that modify the hosts file (`focus`, `clear`).

- **Add websites to block**:
  ```bash
  devfocus add youtube.com instagram.com reddit.com
  ```
- **Remove websites**:
  ```bash
  devfocus remove youtube.com
  ```
- **Toggle focus mode**:
  ```bash
  sudo devfocus on   # Block websites
  sudo devfocus on -h 2 # Block websites for 2 hours

  sudo devfocus off  # Unblock websites
  ```
- **List blocked websites**:
  ```bash
  devfocus list
  ```
- **Clear block list**:
  ```bash
  sudo devfocus clear
  ```

## Requirements
- **Node.js**: v16 or higher (for npm/source installation).
- **Administrative Privileges**: Required for modifying the hosts file (`/etc/hosts` on macOS/Linux, `C:\Windows\System32\drivers\etc\hosts` on Windows).

## Contributing
Contributions are welcome! Fork the repository, make changes, and submit a pull request.

## What's coming next?

 - Have the package also in the Homebrew 🍺
 - Stronger block that builds discipline 🔒, you might want to do some hacking for unblocking it again 🤞