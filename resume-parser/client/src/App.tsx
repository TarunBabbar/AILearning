import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import EmailAgent from "./components/EmailAgent";
import LowScoreAgent from "./components/LowScoreAgent";
import IgnoredEmailAgent from "./components/IgnoredEmailAgent";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agent" element={<EmailAgent />} />
          <Route path="/low-score" element={<LowScoreAgent />} />
          <Route path="/ignored-agent" element={<IgnoredEmailAgent />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
