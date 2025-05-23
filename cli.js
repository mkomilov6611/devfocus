#!/usr/bin/env node

const fs = require("fs").promises;
const { exec } = require("child_process");
const os = require("os");
const { program } = require("commander");
const util = require("util");
const path = require("path");

const execPromise = util.promisify(exec);

// Platform-specific hosts file path
const HOSTS_FILE =
  os.platform() === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";
const BLOCK_IP = "127.0.0.1";
const BLOCK_IP6 = "::1";
const MARKER_START = "# WEBSITE_BLOCKER_START";
const MARKER_END = "# WEBSITE_BLOCKER_END";
const BLOCKLIST_FILE = path.join(__dirname, "blocklist.json");

// Function to check if running with admin privileges
async function hasAdminPrivileges() {
  if (os.platform() === "win32") {
    // On Windows, attempt to write to a system directory to check elevation
    try {
      await fs.writeFile("C:\\Windows\\System32\\test.txt", "test");
      await fs.unlink("C:\\Windows\\System32\\test.txt");
      return true;
    } catch {
      return false;
    }
  } else {
    // On Unix-like systems, check if effective user ID is 0 (root)
    try {
      const { stdout } = await execPromise("id -u");
      return parseInt(stdout.trim(), 10) === 0;
    } catch {
      // Fallback to fs.access if id command fails
      try {
        await fs.access(HOSTS_FILE, fs.constants.W_OK);
        return true;
      } catch {
        return false;
      }
    }
  }
}

// Function to read the hosts file
async function readHostsFile() {
  try {
    return await fs.readFile(HOSTS_FILE, "utf8");
  } catch (error) {
    throw new Error(`Error reading hosts file: ${error.message}`);
  }
}

// Function to write to the hosts file
async function writeHostsFile(content) {
  try {
    if (os.platform() === "win32") {
      // Use PowerShell for reliable file writing on Windows
      await execPromise(
        `powershell -Command "Set-Content -Path '${HOSTS_FILE}' -Value \\"${content.replace(
          /"/g,
          '`"'
        )}\\""`
      );
    } else {
      // Use tee with sudo for Unix-like systems, with explicit error handling
      await execPromise(
        `echo "${content.replace(
          /"/g,
          '\\"'
        )}" | sudo tee "${HOSTS_FILE}" > /dev/null`
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to write to hosts file: ${error.message}. Ensure the command is run with sudo on macOS/Linux or as Administrator on Windows.`
    );
  }
}

// Function to read the block list from file
async function readBlockList() {
  try {
    const data = await fs.readFile(BLOCKLIST_FILE, "utf8");
    return JSON.parse(data).websites || [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw new Error(`Error reading block list: ${error.message}`);
  }
}

// Function to write the block list to file
async function writeBlockList(websites) {
  try {
    await fs.writeFile(BLOCKLIST_FILE, JSON.stringify({ websites }, null, 2));
  } catch (error) {
    throw new Error(`Error writing block list: ${error.message}`);
  }
}

// Function to get current blocked websites from hosts file
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

// Function to check if focus mode is on
async function isFocusModeOn() {
  const blockedWebsites = await getBlockedWebsites();
  return blockedWebsites.length > 0;
}

// Function to add websites to block list
async function addWebsites(websites) {
  const currentBlockList = await readBlockList();
  const newWebsites = [
    ...new Set(websites.filter((site) => !currentBlockList.includes(site))),
  ];

  if (newWebsites.length === 0) {
    console.log("All provided websites are already in the block list.");
    return;
  }

  const updatedBlockList = [...currentBlockList, ...newWebsites];
  await writeBlockList(updatedBlockList);

  console.log(`\nAdded websites to block list: ${newWebsites.join(", ")} ⚡`);
}

// Function to remove websites from block list
async function removeWebsites(websites) {
  const currentBlockList = await readBlockList();
  const updatedBlockList = currentBlockList.filter(
    (site) => !websites.includes(site)
  );

  if (currentBlockList.length === updatedBlockList.length) {
    console.log("No matching websites found in the block list.");
    return;
  }

  await writeBlockList(updatedBlockList);

  if (await isFocusModeOn()) {
    await applyBlockList();
  }
  console.log(`Removed websites from block list: ${websites.join(", ")}`);
}

// Function to clear block list
async function clearWebsites() {
  await writeBlockList([]);
  await clearHostsFile();
  console.log("Cleared all blocked websites and block list. 💯\n");
}

// Function to print block list
async function printWebsites() {
  const websites = await readBlockList();
  const focusMode = await isFocusModeOn();
  if (websites.length === 0) {
    console.log("No websites in the block list.");
  } else {
    console.log(`Block list (Focus mode: ${focusMode ? "ON" : "OFF"}):`);
    websites.forEach((site) => console.log(`- ${site}`));
  }
}

// Function to apply block list to hosts file
async function applyBlockList() {
  let hostsContent = await readHostsFile();
  const websites = await readBlockList();

  // Remove existing blocked section
  const regex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
  hostsContent = hostsContent.replace(regex, "");

  // Add block entries if focus mode is on
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
    `Focus mode is ON 🎯\nBlocked websites: ${websites.join(", ")} 🚫`
  );
  console.log(
    `If the websites still not blocked, it may be necessary to restart the browser 🔌\n`
  );
}

// Function to clear hosts file of blocked websites
async function clearHostsFile() {
  let hostsContent = await readHostsFile();
  const regex = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, "g");
  hostsContent = hostsContent.replace(regex, "");
  await writeHostsFile(hostsContent);
  await flushDnsCache();

  console.log("Focus mode is OFF 📶 All websites unblocked 🟢");
}

// Function to flush DNS cache (cross-platform)
async function flushDnsCache() {
  try {
    if (os.platform() === "darwin") {
      await execPromise(
        "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder"
      );
    } else if (os.platform() === "linux") {
      await execPromise(
        "sudo systemd-resolve --flush-caches || sudo resolvectl flush-caches"
      );
    } else if (os.platform() === "win32") {
      await execPromise("ipconfig /flushdns");
    }
    console.log("\nDNS cache flushed 🚀");
  } catch (error) {
    console.warn(`Warning: Could not flush DNS cache: ${error.message}`);
  }
}
// CLI setup with commander
program
  .version("1.0.0")
  .description(
    "A cross-platform CLI tool to block websites for focused work with a focus mode toggle. 🚀"
  );

program
  .command("focus [state]")
  .description(
    "Control focus mode to block/unblock websites (state: 'on' or 'off')"
  )
  .action(async (state) => {
    if (!(await hasAdminPrivileges())) {
      console.error(
        "Error: This command requires administrative privileges. Run with sudo on macOS/Linux or as Administrator on Windows."
      );
      process.exit(1);
    }
    try {
      if (!state || state.toLowerCase() === "on") {
        const websites = await readBlockList();
        if (websites.length === 0) {
          console.log(
            'No websites in block list. Add websites using the "add" command.'
          );
          return;
        }
        await applyBlockList();
      } else if (state.toLowerCase() === "off") {
        await clearHostsFile();
      } else {
        console.error(
          "Error: Invalid state. Use 'on' or 'off' as the state argument."
        );
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Other commands (add, remove, print, clear) remain unchanged
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

program
  .command("clear")
  .description("Clear all blocked websites and block list")
  .action(async () => {
    if (!(await hasAdminPrivileges())) {
      console.error(
        "Error: This command requires administrative privileges. Run with sudo on macOS/Linux or as Administrator on Windows."
      );
      process.exit(1);
    }
    try {
      await clearWebsites();
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
