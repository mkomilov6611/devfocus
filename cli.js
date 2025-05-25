#!/usr/bin/env node

/**
 * Website Blocker CLI Tool
 * Cross-platform command-line tool for blocking distracting websites by modifying the system hosts file.
 */

const fs = require("fs").promises;
const { exec } = require("child_process");
const os = require("os");
const { program } = require("commander");
const util = require("util");
const path = require("path");

const execPromise = util.promisify(exec);

// Configuration constants
const HOSTS_FILE =
  os.platform() === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";
const BLOCK_IP = "127.0.0.1";
const BLOCK_IP6 = "::1";
const MARKER_START = "# WEBSITE_BLOCKER_START";
const MARKER_END = "# WEBSITE_BLOCKER_END";
const BLOCKLIST_FILE = path.join(__dirname, "blocklist.json");

// Error messages
const ERRORS = {
  ADMIN_REQUIRED:
    "Error: This command requires administrative privileges. Run with sudo on macOS/Linux or as Administrator on Windows.",
  INVALID_STATE:
    "Error: Invalid state. Use 'on' or 'off' as the state argument.",
  NO_WEBSITES:
    'No websites in block list. Add websites using the "add" command.',
  HOSTS_READ: "Error reading hosts file",
  HOSTS_WRITE:
    "Failed to write to hosts file. Ensure the command is run with sudo on macOS/Linux or as Administrator on Windows.",
  BLOCKLIST_READ: "Error reading block list",
  BLOCKLIST_WRITE: "Error writing block list",
};

// Success messages
const MESSAGES = {
  ADDED: "Added websites to block list",
  REMOVED: "Removed websites from block list",
  FOCUS_ON: "Focus mode is ON 🎯",
  FOCUS_OFF: "Focus mode is OFF 📶 All websites unblocked 🟢",
  CLEARED: "Cleared all blocked websites and block list. 💯",
  DNS_FLUSHED: "DNS cache flushed 🚀",
  RESTART_BROWSER:
    "If the websites still not blocked, it may be necessary to restart the browser 🔌",
  ALL_EXISTS: "All provided websites are already in the block list.",
  NONE_FOUND: "No matching websites found in the block list.",
  EMPTY_LIST: "No websites in the block list.",
};

/**
 * Checks if running with administrative privileges
 */
async function hasAdminPrivileges() {
  if (os.platform() === "win32") {
    try {
      const testFile = "C:\\Windows\\System32\\test.txt";
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  } else {
    try {
      const { stdout } = await execPromise("id -u");
      return parseInt(stdout.trim(), 10) === 0;
    } catch {
      try {
        await fs.access(HOSTS_FILE, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Reads the hosts file content
 */
async function readHostsFile() {
  try {
    return await fs.readFile(HOSTS_FILE, "utf8");
  } catch (error) {
    throw new Error(`${ERRORS.HOSTS_READ}: ${error.message}`);
  }
}

/**
 * Writes content to the hosts file using platform-appropriate methods
 */
async function writeHostsFile(content) {
  try {
    if (os.platform() === "win32") {
      await execPromise(
        `powershell -Command "Set-Content -Path '${HOSTS_FILE}' -Value \\"${content.replace(
          /"/g,
          '`"'
        )}\\""`
      );
    } else {
      await execPromise(
        `echo "${content.replace(
          /"/g,
          '\\"'
        )}" | sudo tee "${HOSTS_FILE}" > /dev/null`
      );
    }
  } catch (error) {
    throw new Error(`${ERRORS.HOSTS_WRITE}: ${error.message}`);
  }
}

/**
 * Reads the persistent block list from JSON file
 */
async function readBlockList() {
  try {
    const data = await fs.readFile(BLOCKLIST_FILE, "utf8");
    return JSON.parse(data).websites || [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`${ERRORS.BLOCKLIST_READ}: ${error.message}`);
  }
}

/**
 * Writes the block list to persistent JSON file
 */
async function writeBlockList(websites) {
  try {
    await fs.writeFile(BLOCKLIST_FILE, JSON.stringify({ websites }, null, 2));
  } catch (error) {
    throw new Error(`${ERRORS.BLOCKLIST_WRITE}: ${error.message}`);
  }
}

/**
 * Extracts currently blocked websites from hosts file
 */
async function getBlockedWebsites() {
  const hostsContent = await readHostsFile();
  const regex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, "g");
  const blockSection = hostsContent.match(regex)?.[0] || "";

  const websites = blockSection
    .split("\n")
    .filter(
      (line) =>
        line.includes(BLOCK_IP) &&
        !line.includes(MARKER_START) &&
        !line.includes(MARKER_END)
    )
    .map((line) => line.split(/\s+/)[1])
    .filter((site) => site && !site.startsWith("www."));

  return [...new Set(websites)];
}

/**
 * Checks if focus mode is currently active
 */
async function isFocusModeOn() {
  const blockedWebsites = await getBlockedWebsites();
  return blockedWebsites.length > 0;
}

/**
 * Adds websites to the block list
 */
async function addWebsites(websites) {
  const currentBlockList = await readBlockList();
  const newWebsites = [
    ...new Set(websites.filter((site) => !currentBlockList.includes(site))),
  ];

  if (newWebsites.length === 0) {
    console.log(MESSAGES.ALL_EXISTS);
    return;
  }

  const updatedBlockList = [...currentBlockList, ...newWebsites];
  await writeBlockList(updatedBlockList);
  console.log(`${MESSAGES.ADDED}: ${newWebsites.join(", ")} ⚡`);
}

/**
 * Removes websites from the block list
 */
async function removeWebsites(websites) {
  const currentBlockList = await readBlockList();
  const updatedBlockList = currentBlockList.filter(
    (site) => !websites.includes(site)
  );

  if (currentBlockList.length === updatedBlockList.length) {
    console.log(MESSAGES.NONE_FOUND);
    return;
  }

  await writeBlockList(updatedBlockList);

  if (await isFocusModeOn()) {
    await applyBlockList();
  }
  console.log(`${MESSAGES.REMOVED}: ${websites.join(", ")}`);
}

/**
 * Clears all blocked websites
 */
async function clearWebsites() {
  await writeBlockList([]);
  await clearHostsFile();
  console.log(`${MESSAGES.CLEARED}\n`);
}

/**
 * Displays current block list and focus mode status
 */
async function printWebsites() {
  const websites = await readBlockList();
  const focusMode = await isFocusModeOn();

  if (websites.length === 0) {
    console.log(MESSAGES.EMPTY_LIST);
  } else {
    console.log(`Block list (Focus mode: ${focusMode ? "ON" : "OFF"}):`);
    websites.forEach((site) => console.log(`- ${site}`));
  }
}

/**
 * Applies block list to hosts file (enables focus mode)
 */
async function applyBlockList() {
  let hostsContent = await readHostsFile();
  const websites = await readBlockList();

  // Remove existing blocked section
  const regex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
  hostsContent = hostsContent.replace(regex, "");

  // Add block entries
  let newContent = hostsContent.trim();
  if (websites.length > 0) {
    const blockEntries = websites
      .flatMap((site) => [
        `${BLOCK_IP} ${site}`,
        `${BLOCK_IP} www.${site}`,
        `${BLOCK_IP6} ${site}`,
        `${BLOCK_IP6} www.${site}`,
      ])
      .join("\n");
    newContent = `${newContent}\n${MARKER_START}\n${blockEntries}\n${MARKER_END}\n`;
  }

  await writeHostsFile(newContent);
  await flushDnsCache();

  console.log(
    `${MESSAGES.FOCUS_ON}\nBlocked websites: ${websites.join(", ")} 🚫`
  );
  console.log(`${MESSAGES.RESTART_BROWSER}\n`);
}

/**
 * Removes blocked websites from hosts file (disables focus mode)
 */
async function clearHostsFile() {
  let hostsContent = await readHostsFile();
  const regex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
  hostsContent = hostsContent.replace(regex, "");

  await writeHostsFile(hostsContent);
  await flushDnsCache();
  console.log(MESSAGES.FOCUS_OFF);
}

/**
 * Flushes DNS cache using platform-specific commands
 */
async function flushDnsCache() {
  const commands = {
    darwin: "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder",
    linux:
      "sudo systemd-resolve --flush-caches || sudo resolvectl flush-caches",
    win32: "ipconfig /flushdns",
  };

  try {
    const command = commands[os.platform()];
    if (command) {
      await execPromise(command);
      console.log(`\n${MESSAGES.DNS_FLUSHED}`);
    }
  } catch (error) {
    console.warn(`Warning: Could not flush DNS cache: ${error.message}`);
  }
}

// CLI setup
program
  .version("1.0.4")
  .description(
    "A cross-platform CLI tool to block websites for focused work 🚀"
  );

// Focus mode commands
program
  .command("on")
  .description("Enable focus mode (block websites)")
  .action(async () => {
    if (!(await hasAdminPrivileges())) {
      console.error(ERRORS.ADMIN_REQUIRED);
      process.exit(1);
    }

    try {
      const websites = await readBlockList();
      if (websites.length === 0) {
        console.log(ERRORS.NO_WEBSITES);
        return;
      }
      await applyBlockList();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("off")
  .description("Disable focus mode (unblock websites)")
  .action(async () => {
    if (!(await hasAdminPrivileges())) {
      console.error(ERRORS.ADMIN_REQUIRED);
      process.exit(1);
    }

    try {
      await clearHostsFile();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Add command
program
  .command("add <websites...>")
  .description("Add websites to the block list")
  .action(async (websites) => {
    try {
      await addWebsites(websites.map((site) => site.trim()));
      if (await isFocusModeOn()) {
        await applyBlockList();
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Remove command
program
  .command("remove <websites...>")
  .description("Remove websites from the block list")
  .action(async (websites) => {
    try {
      await removeWebsites(websites.map((site) => site.trim()));
      if (await isFocusModeOn()) {
        await applyBlockList();
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Print command
program
  .command("print")
  .description("Print the current block list")
  .action(async () => {
    try {
      await printWebsites();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Clear command
program
  .command("clear")
  .description("Clear all blocked websites and block list")
  .action(async () => {
    if (!(await hasAdminPrivileges())) {
      console.error(ERRORS.ADMIN_REQUIRED);
      process.exit(1);
    }

    try {
      await clearWebsites();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse(process.argv);
}

module.exports = {
  hasAdminPrivileges,
  readHostsFile,
  writeHostsFile,
  readBlockList,
  writeBlockList,
  getBlockedWebsites,
  isFocusModeOn,
  addWebsites,
  removeWebsites,
  clearWebsites,
  printWebsites,
  applyBlockList,
  clearHostsFile,
  flushDnsCache,
};
