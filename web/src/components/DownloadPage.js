import React from "react";
import {
  FITGPT_DOWNLOAD_PAGE_URL,
  FITGPT_WEB_URL,
  SYMPOSIUM_APK_DOWNLOAD_URL,
  SYMPOSIUM_GITHUB_RELEASE_URL,
} from "../constants/symposiumRelease";

const WEB_APP_URL = FITGPT_WEB_URL;
const DOWNLOAD_PAGE_URL = FITGPT_DOWNLOAD_PAGE_URL;
const APK_DOWNLOAD_URL = SYMPOSIUM_APK_DOWNLOAD_URL;
const GITHUB_SYMPOSIUM_RELEASE_URL = SYMPOSIUM_GITHUB_RELEASE_URL;

const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(DOWNLOAD_PAGE_URL)}`;
const APK_QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(APK_DOWNLOAD_URL)}`;

function DownloadCard({ title, text, buttonLabel, href, primary = false, note = null }) {
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-download-title`;

  return (
    <section className="downloadCard" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{text}</p>
        {note ? <p className="downloadCardNote">{note}</p> : null}
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
        <h1>Welcome to FitGPT</h1>
        <p>Try the live web app or download the Android app.</p>
      </section>

      <div className="downloadGrid">
        <DownloadCard
          title="Web App"
          text="Open the current FitGPT web experience in your browser — no install needed."
          buttonLabel="Open FitGPT Web"
          href={WEB_APP_URL}
          primary
        />
        <DownloadCard
          title="Android App"
          text="Download and sideload the FitGPT APK on any Android device."
          buttonLabel="Download FitGPT Android APK"
          href={APK_DOWNLOAD_URL}
          note='After downloading, open the APK file. If Android blocks it, go to Settings → Security → "Install unknown apps" and allow your browser or file manager.'
        />
      </div>

      <section className="downloadQr" aria-labelledby="download-qr-title">
        <h2 id="download-qr-title">Scan to open FitGPT</h2>
        <div className="downloadQrGrid">
          <article className="downloadQrItem">
            <img
              src={QR_CODE_URL}
              width="180"
              height="180"
              alt="QR code to open the FitGPT download page"
            />
            <h3>Web Page</h3>
            <p>
              Open this page:{" "}
              <a href={DOWNLOAD_PAGE_URL}>{DOWNLOAD_PAGE_URL}</a>
            </p>
          </article>
          <article className="downloadQrItem">
            <img
              src={APK_QR_CODE_URL}
              width="180"
              height="180"
              alt="QR code to download the FitGPT Android APK"
            />
            <h3>Android APK</h3>
            <p>
              Scan to download:{" "}
              <a href={APK_DOWNLOAD_URL}>FitGPT Android APK</a>
            </p>
            <p className="downloadCardNote">
              Backup:{" "}
              <a href={GITHUB_SYMPOSIUM_RELEASE_URL} target="_blank" rel="noreferrer">
                GitHub release page
              </a>{" "}
              if the direct link does not open.
            </p>
          </article>
        </div>
      </section>

      <p className="downloadSupportNote">
        Having trouble installing? Use the web app at{" "}
        <a href={WEB_APP_URL}>fitgpt.tech</a> — it works on any device.
      </p>
    </main>
  );
}
