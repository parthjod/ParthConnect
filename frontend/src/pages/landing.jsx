import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "../App.css";

export default function LandingPage() {
  const router = useNavigate();

  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <h2>ParthConnect</h2>
        </div>
        <div className="navList">
          <p
            role="button"
            onClick={() => {
              router("/sdfn61");
            }}
          >
            Join as Guest
          </p>
          <p
            role="button"
            onClick={() => {
              router("/auth");
            }}
          >
            Register
          </p>
          <button
            onClick={() => {
              router("/auth");
            }}
          >
            Login
          </button>
        </div>
      </nav>
      <div className="landingMainContainer">
        <div>
          <h2>
            <span style={{ color: "orange" }}>Distance </span>means nothing,
          </h2>
          <h2>Connect anytime</h2>
          <p style={{ marginTop: "20px" }}>Laugh, talk, connect on ParthConnect</p>
          <div role="button">
            <Link to={"/auth"}>Get Started</Link>
          </div>
        </div>
        <div>
          <img src="/mobile.png" style={{ width: "550px", borderRadius: "10px" }} alt="mobile" />
        </div>
      </div>
    </div>
  );
}
