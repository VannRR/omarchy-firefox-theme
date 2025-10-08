# omarchy-firefox-theme

## Project Overview

This repository contains a Firefox extension that dynamically themes your browser from your current [omarchy](https://omarchy.org/) chromium theme and a native helper application that watches `$HOME/.config/omarchy/current/theme/chromium.theme` for changes and updates your browser's theme immediately.

## Features

- Uses Material 3 theme generation to produce themes that closely match Chromium’s dynamic theming.
- Native watcher process detects file changes and triggers theme updates automatically.
- Integrates with the [@material/material-color-utilities](https://www.npmjs.com/package/@material/material-color-utilities) package for color utilities and Material 3 palette generation.
- Compatible with *Firefox*, *Floorp* and *Librewolf*

## Installation

### Prerequisites
- Install dependencies:
- ```sudo pacman -S --needed base-devel git```

### Build and install
1. Clone repo:
```git clone https://github.com/vannrr/omarchy-firefox-theme.git```

2. Change directory
```cd omarchy-firefox-theme```

3. Build and install the package with `makepkg`:
```makepkg -si```

## Licenses and Attribution

This project ports and adapts some Chromium source code for theme color generation; Chromium is distributed under a BSD-style license, and those portions are used under that license.

This project depends on the @material/material-color-utilities npm package, which is licensed under Apache License 2.0.

Where Chromium source code is used, attribution to the original Chromium authors is retained and license requirements are followed.

## Development Notes

The theme generation aims to match Chromium’s dynamic theming behavior closely; that is the reason for reusing parts of Chromium’s palette generation logic.

Review the license file before distribution to ensure compliance with BSD-style and Apache 2.0 license obligations.
