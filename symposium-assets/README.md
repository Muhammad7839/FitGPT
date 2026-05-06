# FitGPT App Access

**Public download page (recommended entry point):**  
https://www.fitgpt.tech/download

## Android APK (symposium-demo-v1)

The live GitHub release **`symposium-demo-v1`** currently hosts the symposium APK as:

**Direct download (primary):**  
https://github.com/Muhammad7839/FitGPT/releases/download/symposium-demo-v1/app-debug.apk

**Backup** if a browser or network blocks direct file URLs:  
https://github.com/Muhammad7839/FitGPT/releases/tag/symposium-demo-v1

The public `/download` page shows separate QR codes for the web page and the Android APK, and includes the GitHub release link as a fallback.

> If you later upload a renamed asset (for example `FitGPT-Symposium-Demo.apk`), update `web/src/constants/symposiumRelease.js` to match the **exact** filename on the release, redeploy the web app, and re-test QR codes.

## Android install steps

1. Scan the QR code or open `/download`.
2. Tap **Download FitGPT Android APK**.
3. Open the downloaded APK.
4. If Android asks, allow installs from this browser or file manager (**Install unknown apps** / similar).
5. Install FitGPT and open the app; sign in or create an account.

## Web

1. Scan the QR code for the download page or open **https://www.fitgpt.tech**.
2. Tap **Open FitGPT Web**.
3. Use FitGPT in the browser.

## Local build output paths (developers)

- Debug APK: `app/build/outputs/apk/debug/app-debug.apk`
- Unsigned release APK: `app/build/outputs/apk/release/app-release-unsigned.apk`

These paths are for **local builds** only. The **public** symposium link is the GitHub release URL above, not a path on a judge’s machine.

## Troubleshooting

If installation does not work, use the web app — it uses the same production backend. Try the **GitHub release page** link if the direct APK URL fails on restrictive networks.
