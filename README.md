# Stocus

Stocus is a mindful Chrome extension designed to help you focus by temporarily blocking distracting websites. When you start a focus session, **all** websites are blocked except for the specific domains you have whitelisted (e.g., `coursera.org`).

## Features
- **Whitelist Mode:** Block the entire internet except for the sites you need to study or work.
- **Customizable Timer:** Set a focus timer (default is 15 minutes) and stay on track.
- **Sleek UI:** A clean, minimal, and calming interface designed to keep you centered.

## Installation (Developer Mode)
1. Clone this repository or download the ZIP.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** and select the `Stocus` folder.
5. The extension is now installed. Pin it to your toolbar for easy access!

## Usage
1. Click the Stocus icon in your toolbar.
2. Click the gear icon (Settings) to open the Options page.
3. Add domains you want to allow during focus time (e.g., `coursera.org`, `github.com`).
4. Close the settings, open the popup again, set your desired focus time, and click **Start Focus**.
5. Try visiting a non-allowed site—it will be blocked until the timer runs out or you manually stop it!

## Testing
The background service worker's core logic (whitelist domain normalization,
focus session start/stop, history logging, alarm handling) is covered by a
small test suite that loads `background.js` into a sandboxed context with a
mocked `chrome` API and exercises it with real inputs. Run it with:
```
npm test
```

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
