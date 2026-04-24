import React from "react";

const APK_DOWNLOAD_URL = "https://github.com/Muhammad7839/FitGPT/releases/download/symposium-demo-v1/FitGPT-Symposium-Demo.apk";
const WEB_DEMO_URL = "https://fit-gpt-i3co.vercel.app";

function DownloadCard({ title, text, note, buttonLabel, href, primary = false }) {
  return (
    <section className="downloadCard" aria-labelledby={`${title.toLowerCase()}-download-title`}>
      <div>
        <h2 id={`${title.toLowerCase()}-download-title`}>{title}</h2>
        <p>{text}</p>
        {note ? <p className="downloadNote">{note}</p> : null}
      </div>
      <a
        className={`downloadButton${primary ? " primary" : ""}`}
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {buttonLabel}
      </a>
    </section>
  );
}

export default function DownloadPage() {
  return (
    <main className="downloadPage">
      <section className="downloadHero">
        <p className="downloadEyebrow">Senior Symposium</p>
        <h1>Download FitGPT</h1>
        <p>Choose your device to try FitGPT at Senior Symposium.</p>
      </section>

      <div className="downloadGrid">
        <DownloadCard
          title="Android"
          text="Download the APK, open it, and follow Android's install prompt."
          note="If Android asks for permission, allow installs from this browser or file manager, then return and install FitGPT."
          buttonLabel="Download Android App"
          href={APK_DOWNLOAD_URL}
          primary
        />
        <DownloadCard
          title="iPhone"
          text="The Android app cannot be installed on iPhone. Use the live web version instead."
          buttonLabel="Open Web Demo"
          href={WEB_DEMO_URL}
        />
        <DownloadCard
          title="Having trouble?"
          text="If installation does not work, use the web demo. It connects to the same live backend."
          buttonLabel="Open Web Demo"
          href={WEB_DEMO_URL}
        />
      </div>

      <aside className="downloadBestDemo">
        <strong>For best demo experience</strong>
        <span>Create an account or sign in, then try wardrobe, outfits, and recommendations.</span>
      </aside>
    </main>
  );
}
