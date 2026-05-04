import React, { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  useEffect(() => {
    document.title = "FitGPT — Page not found";
    return () => {
      document.title = "FitGPT";
    };
  }, []);

  return (
    <div className="onboarding onboardingPage">
      <div className="brandBar">
        <div className="brandLeft">
          <div className="brandMark">
            <img className="brandLogo" src="/officialLogo.png" alt="FitGPT official logo" />
          </div>
        </div>
      </div>
      <div className="card authCard">
        <h1 className="authTitle">Page not found</h1>
        <p className="authSub">That URL does not match any FitGPT screen.</p>
        <Link className="btn primary" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
