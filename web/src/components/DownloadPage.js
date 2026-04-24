import React from "react";

const APK_DOWNLOAD_URL = "https://github.com/Muhammad7839/FitGPT/releases/download/symposium-demo-v1/FitGPT-Symposium-Demo.apk";
const WEB_APP_URL = "https://www.fitgpt.tech/";
const DOWNLOAD_PAGE_URL = "https://www.fitgpt.tech/download";
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(DOWNLOAD_PAGE_URL)}`;
const APK_QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(APK_DOWNLOAD_URL)}`;

function DownloadCard({ title, text, buttonLabel, href, primary = false }) {
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-download-title`;

  return (
    <section className="downloadCard" aria-labelledby={titleId}>
      <div>
        <h2 id={titleId}>{title}</h2>
        <p>{text}</p>
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
        <h1>Welcome to FITGPT</h1>
        <p>Try the live web app or download the Android app.</p>
      </section>

      <div className="downloadGrid">
        <DownloadCard
          title="Web App"
          text="Open the current FitGPT web experience in your browser."
          buttonLabel="Open FITGPT Web"
          href={WEB_APP_URL}
          primary
        />
        <DownloadCard
          title="Android App"
          text="Download the Android APK and install it on an Android device."
          buttonLabel="Download Android APK"
          href={APK_DOWNLOAD_URL}
        />
      </div>

      <section className="downloadQr" aria-labelledby="download-qr-title">
        <h2 id="download-qr-title">Scan to Open FITGPT</h2>
        <div className="downloadQrGrid">
          <article className="downloadQrItem">
            <img
              src={QR_CODE_URL}
              width="180"
              height="180"
              alt="QR code to open the FITGPT download page"
            />
            <h3>Web Page</h3>
            <p>
              Open this page:
              {" "}
              <a href={DOWNLOAD_PAGE_URL}>{DOWNLOAD_PAGE_URL}</a>
            </p>
          </article>
          <article className="downloadQrItem">
            <img
              src={APK_QR_CODE_URL}
              width="180"
              height="180"
              alt="QR code to download the FITGPT Android APK"
            />
            <h3>Android APK</h3>
            <p>
              Download the APK:
              {" "}
              <a href={APK_DOWNLOAD_URL}>FitGPT Android APK</a>
            </p>
          </article>
        </div>
      </section>

      <p className="downloadSupportNote">If the Android install does not work, use the web app.</p>
    </main>
  );
}
