import "./App.css";
import React, { useState } from "react";
import Onboarding from "./components/Onboarding";
import Dashboard from "./components/Dashboard";

function App() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  return (
    <div className="app">
      {hasCompletedOnboarding ? (
        <Dashboard />
      ) : (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}

export default App;
