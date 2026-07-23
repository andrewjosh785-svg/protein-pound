// SDK 52+ auto-configures Metro for npm-workspaces monorepos via expo/metro-config's
// default config — no manual watchFolders/nodeModulesPaths needed (confirmed against
// the versioned Expo 57 docs, per this package's own AGENTS.md instruction to check
// exact versioned docs before writing Expo config). This file exists mainly as the
// place to customize resolution later if @protein-pound/shared's un-built .ts entry
// point ever needs a resolver tweak.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
