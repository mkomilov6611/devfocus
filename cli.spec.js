// Mock dependencies first, before any imports to ensure they are mocked correctly
const mockExecPromise = jest.fn();

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn(),
    constants: {
      W_OK: 2,
    },
  },
}));

jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

jest.mock("os", () => ({
  platform: jest.fn(),
}));

jest.mock("util", () => ({
  promisify: jest.fn(() => mockExecPromise),
}));

// Import modules after mocking
const fs = require("fs").promises;
const os = require("os");

// Import the module after mocking
const {
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
} = require("./cli");

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, "log").mockImplementation(),
  error: jest.spyOn(console, "error").mockImplementation(),
  info: jest.spyOn(console, "info").mockImplementation(),
  warn: jest.spyOn(console, "warn").mockImplementation(),
};

describe("Website Blocker CLI Tool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecPromise.mockClear();

    // Reset console spies
    Object.values(consoleSpy).forEach((spy) => spy.mockClear());
  });

  describe("hasAdminPrivileges", () => {
    it("should return true for Windows admin user", async () => {
      os.platform.mockReturnValue("win32");
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const result = await hasAdminPrivileges();
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        "C:\\Windows\\System32\\test.txt",
        "test"
      );
      expect(fs.unlink).toHaveBeenCalledWith("C:\\Windows\\System32\\test.txt");
    });

    it("should return false for Windows non-admin user", async () => {
      os.platform.mockReturnValue("win32");
      fs.writeFile.mockRejectedValue(new Error("Access denied"));

      const result = await hasAdminPrivileges();
      expect(result).toBe(false);
    });

    it("should return true for Unix root user", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockResolvedValue({ stdout: "0\n" });

      const result = await hasAdminPrivileges();
      expect(result).toBe(true);
      expect(mockExecPromise).toHaveBeenCalledWith("id -u");
    });

    it("should return false for Unix non-root user", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockResolvedValue({ stdout: "1000\n" });

      const result = await hasAdminPrivileges();
      expect(result).toBe(false);
    });

    it("should fallback to fs.access when id command fails", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockRejectedValue(new Error("Command not found"));
      fs.access.mockResolvedValue();

      const result = await hasAdminPrivileges();
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalled();
    });
  });

  describe("readHostsFile", () => {
    it("should read hosts file successfully", async () => {
      const mockContent = "127.0.0.1 localhost";
      fs.readFile.mockResolvedValue(mockContent);

      const result = await readHostsFile();
      expect(result).toBe(mockContent);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining("hosts"),
        "utf8"
      );
    });

    it("should throw error when hosts file cannot be read", async () => {
      fs.readFile.mockRejectedValue(new Error("Permission denied"));

      await expect(readHostsFile()).rejects.toThrow(
        "Error reading hosts file: Permission denied"
      );
    });
  });

  describe("writeHostsFile", () => {
    it("should write to hosts file on Windows using PowerShell", async () => {
      os.platform.mockReturnValue("win32");
      mockExecPromise.mockResolvedValue();

      await writeHostsFile("test content");
      expect(mockExecPromise).toHaveBeenCalledWith(
        expect.stringContaining("powershell")
      );
    });

    it("should write to hosts file on Unix using tee with sudo", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockResolvedValue();

      await writeHostsFile("test content");
      expect(mockExecPromise).toHaveBeenCalledWith(
        expect.stringContaining("sudo tee")
      );
    });

    it("should throw error when write fails", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockRejectedValue(new Error("Permission denied"));

      await expect(writeHostsFile("test")).rejects.toThrow(
        "Failed to write to hosts file"
      );
    });
  });

  describe("readBlockList", () => {
    it("should read block list from file", async () => {
      const mockData = { websites: ["example.com", "test.com"] };
      fs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await readBlockList();
      expect(result).toEqual(["example.com", "test.com"]);
    });

    it("should return empty array when file doesn't exist", async () => {
      const error = new Error("File not found");
      error.code = "ENOENT";
      fs.readFile.mockRejectedValue(error);

      const result = await readBlockList();
      expect(result).toEqual([]);
    });

    it("should throw error for other file read errors", async () => {
      fs.readFile.mockRejectedValue(new Error("Permission denied"));

      await expect(readBlockList()).rejects.toThrow("Error reading block list");
    });
  });

  describe("writeBlockList", () => {
    it("should write block list to file", async () => {
      fs.writeFile.mockResolvedValue();

      await writeBlockList(["example.com", "test.com"]);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("blocklist.json"),
        JSON.stringify({ websites: ["example.com", "test.com"] }, null, 2)
      );
    });

    it("should throw error when write fails", async () => {
      fs.writeFile.mockRejectedValue(new Error("Permission denied"));

      await expect(writeBlockList(["example.com"])).rejects.toThrow(
        "Error writing block list"
      );
    });
  });

  describe("getBlockedWebsites", () => {
    it("should extract blocked websites from hosts file", async () => {
      const hostsContent = `
127.0.0.1 localhost
# WEBSITE_BLOCKER_START
127.0.0.1 example.com
127.0.0.1 www.example.com
127.0.0.1 test.com
127.0.0.1 www.test.com
# WEBSITE_BLOCKER_END`;

      fs.readFile.mockResolvedValue(hostsContent);

      const result = await getBlockedWebsites();
      expect(result).toEqual(["example.com", "test.com"]);
    });

    it("should return empty array when no blocked section exists", async () => {
      fs.readFile.mockResolvedValue("127.0.0.1 localhost");

      const result = await getBlockedWebsites();
      expect(result).toEqual([]);
    });
  });

  describe("isFocusModeOn", () => {
    it("should return true when websites are blocked", async () => {
      const hostsContent = `
          # WEBSITE_BLOCKER_START
          127.0.0.1 example.com
          # WEBSITE_BLOCKER_END
        `;
      fs.readFile.mockResolvedValue(hostsContent);

      const result = await isFocusModeOn();
      expect(result).toBe(true);
    });

    it("should return false when no websites are blocked", async () => {
      fs.readFile.mockResolvedValue("127.0.0.1 localhost");

      const result = await isFocusModeOn();
      expect(result).toBe(false);
    });
  });

  describe("addWebsites", () => {
    it("should add new websites to block list", async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({ websites: ["existing.com"] })
      );
      fs.writeFile.mockResolvedValue();

      await addWebsites(["new.com", "another.com"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("blocklist.json"),
        JSON.stringify(
          { websites: ["existing.com", "new.com", "another.com"] },
          null,
          2
        )
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Added websites to block list")
      );
    });

    it("should not add duplicate websites", async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({ websites: ["existing.com"] })
      );
      fs.writeFile.mockResolvedValue();

      await addWebsites(["existing.com"]);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "All provided websites are already in the block list."
      );
    });
  });

  describe("removeWebsites", () => {
    it("should remove websites from block list", async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({
          websites: ["example.com", "test.com", "keep.com"],
        })
      );
      fs.writeFile.mockResolvedValue();

      await removeWebsites(["example.com", "test.com"]);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("blocklist.json"),
        JSON.stringify({ websites: ["keep.com"] }, null, 2)
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Removed websites from block list")
      );
    });

    it("should handle removal of non-existent websites", async () => {
      fs.readFile.mockResolvedValue(
        JSON.stringify({ websites: ["existing.com"] })
      );

      await removeWebsites(["nonexistent.com"]);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "No matching websites found in the block list."
      );
    });
  });

  describe("clearWebsites", () => {
    it("should clear all websites and block list", async () => {
      fs.writeFile.mockResolvedValue();
      fs.readFile.mockResolvedValue("127.0.0.1 localhost");
      mockExecPromise.mockResolvedValue();
      os.platform.mockReturnValue("linux");

      await clearWebsites();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("blocklist.json"),
        JSON.stringify({ websites: [] }, null, 2)
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Cleared all blocked websites")
      );
    });
  });

  describe("printWebsites", () => {
    it("should print websites when block list exists", async () => {
      fs.readFile
        .mockResolvedValueOnce(
          JSON.stringify({ websites: ["example.com", "test.com"] })
        )
        .mockResolvedValueOnce("127.0.0.1 localhost");

      await printWebsites();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Block list (Focus mode: OFF)")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith("- example.com");
      expect(consoleSpy.log).toHaveBeenCalledWith("- test.com");
    });

    it("should print message when no websites in block list", async () => {
      fs.readFile.mockResolvedValue(JSON.stringify({ websites: [] }));

      await printWebsites();

      expect(consoleSpy.log).toHaveBeenCalledWith(
        "No websites in the block list."
      );
    });
  });

  describe("applyBlockList", () => {
    it("should apply block list to hosts file", async () => {
      fs.readFile
        .mockResolvedValueOnce("127.0.0.1 localhost")
        .mockResolvedValueOnce(JSON.stringify({ websites: ["example.com"] }));
      mockExecPromise.mockResolvedValue();
      os.platform.mockReturnValue("linux");

      await applyBlockList();

      expect(mockExecPromise).toHaveBeenCalledWith(
        expect.stringContaining("sudo tee")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Focus mode is ON")
      );
    });
  });

  describe("clearHostsFile", () => {
    it("should remove blocked websites from hosts file", async () => {
      const hostsWithBlocks = `127.0.0.1 localhost
  # WEBSITE_BLOCKER_START
  127.0.0.1 example.com
  # WEBSITE_BLOCKER_END`;
      fs.readFile.mockResolvedValue(hostsWithBlocks);
      mockExecPromise.mockResolvedValue();
      os.platform.mockReturnValue("linux");

      await clearHostsFile();

      expect(mockExecPromise).toHaveBeenCalledWith(
        expect.stringContaining("sudo tee")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Focus mode is OFF")
      );
    });
  });

  describe("flushDnsCache", () => {
    it("should flush DNS cache on macOS", async () => {
      os.platform.mockReturnValue("darwin");
      mockExecPromise.mockResolvedValue();

      await flushDnsCache();

      expect(mockExecPromise).toHaveBeenCalledWith(
        "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder"
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("DNS cache flushed")
      );
    });

    it("should flush DNS cache on Linux", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockResolvedValue();

      await flushDnsCache();

      expect(mockExecPromise).toHaveBeenCalledWith(
        "sudo systemd-resolve --flush-caches || sudo resolvectl flush-caches"
      );
    });

    it("should flush DNS cache on Windows", async () => {
      os.platform.mockReturnValue("win32");
      mockExecPromise.mockResolvedValue();

      await flushDnsCache();

      expect(mockExecPromise).toHaveBeenCalledWith("ipconfig /flushdns");
    });

    it("should handle DNS flush errors gracefully", async () => {
      os.platform.mockReturnValue("linux");
      mockExecPromise.mockRejectedValue(new Error("Command failed"));

      await flushDnsCache();

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Could not flush DNS cache")
      );
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle malformed JSON in block list file", async () => {
      fs.readFile.mockResolvedValue("invalid json");

      await expect(readBlockList()).rejects.toThrow("Error reading block list");
    });

    it("should handle empty hosts file", async () => {
      fs.readFile.mockResolvedValue("");

      const result = await getBlockedWebsites();
      expect(result).toEqual([]);
    });

    it("should handle hosts file without blocked section", async () => {
      fs.readFile.mockResolvedValue("127.0.0.1 localhost\n::1 localhost");

      const result = await getBlockedWebsites();
      expect(result).toEqual([]);
    });

    it("should deduplicate websites in getBlockedWebsites", async () => {
      const hostsContent = `
# WEBSITE_BLOCKER_START
127.0.0.1 example.com
127.0.0.1 www.example.com
::1 example.com
::1 www.example.com
# WEBSITE_BLOCKER_END`;
      fs.readFile.mockResolvedValue(hostsContent);

      const result = await getBlockedWebsites();
      expect(result).toEqual(["example.com"]);
    });
  });
});
