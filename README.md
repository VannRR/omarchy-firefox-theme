# omarchy-firefox-theme

Dynamically sync your Firefox (and forks) theme with [Omarchy’s](https://omarchy.org/) current Chromium theme.
A native helper watches `$HOME/.config/omarchy/current/theme/chromium.theme` and pushes updates to the browser in real time.

## Features

- Material 3 palette matching Chromium’s dynamic theming
- Native watcher for instant theme updates
- Uses [@material/material-color-utilities](https://www.npmjs.com/package/@material/material-color-utilities) for color generation
- Compatible with Firefox, Floorp, Librewolf

## Prerequisites
Install dependencies:
`sudo pacman -S --needed base-devel git`

## Build and install
- ```git clone https://github.com/vannrr/omarchy-firefox-theme.git```
- ```cd omarchy-firefox-theme```
- ```makepkg -si```

## Licenses and Attribution
Ports Chromium’s BSD-licensed color logic (original authors credited)
Depends on @material/material-color-utilities (Apache 2.0)
See LICENSE for full BSD and Apache 2.0 compliance
