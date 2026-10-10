# Stream Deck Plugins

Small, free, open-source plugins for the Elgato Stream Deck on macOS.

| Plugin | What it shows |
| --- | --- |
| [Claude Usage](claude-usage) | Your Claude plan limits (5-hour, weekly, Fable) and where each one lands at the current pace |
| [System Monitor](system-monitor) | CPU, RAM, total system power in watts, network download and upload, each with a live graph |

## Claude Usage

![Claude Usage keys: 5-hour, weekly and Fable limits with forecasts, and a session about to run out](docs/claude-usage.png)

Each key shows how much of a limit you have used, the time until it resets, and a forecast: `→ 78%` is where you land at reset if you keep going at this rate, and above 100% (red, e.g. `→ 130%`) means you hit the limit before the reset. The white tick on the bar is where an even pace would put you right now.

It reads the login Claude Code already keeps, so there is no cookie to paste and no API key. [More](claude-usage)

## System Monitor

![System Monitor keys: CPU, RAM, power, download and upload with one-minute graphs](docs/system-monitor.png)

Updates every 2 seconds, with the last minute as a graph. Power is the whole Mac's draw, read from the SMC without root. [More](system-monitor)

## Install from source

Requirements: macOS 12 or later, Stream Deck 7.1 or later, Node.js 20 or later, and the Xcode Command Line Tools (for System Monitor's native helper).

```bash
git clone https://github.com/zgrgrcn/stream-deck-plugins.git
cd stream-deck-plugins/claude-usage      # or system-monitor
npm install
npm run build
npx streamdeck link com.zgrgrcn.claude-usage.sdPlugin   # or com.zgrgrcn.system-monitor.sdPlugin
```

The plugin then shows up in the Stream Deck app's action list. Drag a key onto your deck and pick what it shows in the key's settings.

While developing, `npm run watch` rebuilds and restarts the plugin on every change, and `npm test` runs the checks.

## Layout

Each plugin is its own folder with its own `package.json`, built from Elgato's official template (`@elgato/streamdeck`, TypeScript, Rollup):

```
<plugin>/
  com.zgrgrcn.<plugin>.sdPlugin/   manifest, images, settings UI (build output goes to bin/)
  src/                             plugin code and tests
```

## Disclaimer

These plugins are independent projects and are not affiliated with, endorsed by, or sponsored by Anthropic or Elgato. Claude and Claude Code are trademarks of Anthropic, PBC.

## License

[MIT](LICENSE) © 2026 Ozgur Gurcan
