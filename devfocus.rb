class Devfocus < Formula
  desc "CLI tool for developers to block distracting websites and manage focus mode"
  homepage "https://github.com/mkomilov6611/devfocus"
  url "https://github.com/mkomilov6611/devfocus/archive/refs/tags/v1.0.1.tar.gz"
  sha256 "<SHA256_CHECKSUM>" # Replace with actual SHA256 checksum of the tarball
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "devfocus", shell_output("#{bin}/devfocus --version")
    assert_match "CLI tool for developers", shell_output("#{bin}/devfocus --help")
  end
end