import React from "react";
import { useLocation } from "react-router-dom";

export default function PageTransition({ children }) {
  const location = useLocation();

  return (
    <div className="pageTransition" key={location.pathname}>
      {children}
    </div>
  );
}
