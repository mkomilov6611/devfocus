# DevFocus
A cross-platform CLI tool designed for developers to block distracting websites, enabling a distraction-free coding environment by modifying the system hosts file.

## Features
- **Block Websites**: Add websites to a block list to prevent access during coding sessions.
- **Focus Mode**: Toggle focus mode to block or unblock websites instantly (`on` or `off`).
- **Cross-Platform**: Works on macOS, Linux, and Windows.
- **Developer-Friendly**: Simple commands to manage distractions, ideal for deep work and coding sprints.

## Installation

### Via npm
```bash
sudo npm install --location=global devfocus
```
Requires Node.js v16 or higher.

### Homebrew - Coming next...

## Usage
Run commands with `sudo` on macOS/Linux or as Administrator on Windows for commands that modify the hosts file (`focus`, `clear`).

- **Add websites to block**:
  ```bash
  devfocus add example.com github.com
  ```
- **Remove websites**:
  ```bash
  devfocus remove example.com
  ```
- **Toggle focus mode**:
  ```bash
  sudo devfocus on   # Block websites
  sudo devfocus off  # Unblock websites
  ```
- **List blocked websites**:
  ```bash
  devfocus print
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