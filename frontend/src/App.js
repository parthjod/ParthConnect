import "./App.css"
import { Route, BrowserRouter as Router, Routes } from "react-router-dom"
import LandingPage from "./pages/landing"
import Authentication from "./pages/authentication"
import { AuthProvider } from "./contexts/AuthContext.jsx"
import VideoMeetComponent from "./pages/VideoMeet.jsx"
import HomeComponent from "./pages/home.jsx"

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Authentication />} />
            <Route path="/:url" element={<VideoMeetComponent />} />
            <Route path="/home" element={<HomeComponent />} />
          </Routes>
        </AuthProvider>
      </Router>
    </div>
  )
}

export default App
