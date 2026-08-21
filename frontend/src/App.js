import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import ProtectedRoute, { EntitledRoute } from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import NewScan from "@/pages/NewScan";
import ScanResult from "@/pages/ScanResult";
import Pricing from "@/pages/Pricing";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Library from "@/pages/Library";
import VerifyBadge from "@/pages/VerifyBadge";

const baseName = process.env.PUBLIC_URL && !process.env.PUBLIC_URL.startsWith("http")
  ? process.env.PUBLIC_URL
  : undefined;

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function Entitled({ children }) {
  return <ProtectedRoute><EntitledRoute>{children}</EntitledRoute></ProtectedRoute>;
}

function App() {
  return (
    <div className="App grain min-h-screen">
      <AuthProvider>
        <BrowserRouter basename={baseName}>
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/join" element={<Register />} />
            <Route path="/verify/:badgeId" element={<VerifyBadge />} />

            <Route path="/app" element={<Protected><Dashboard /></Protected>} />
            <Route path="/app/billing" element={<Protected><Pricing /></Protected>} />
            <Route path="/app/payment-success" element={<Protected><PaymentSuccess /></Protected>} />
            <Route path="/app/scan/new" element={<Entitled><NewScan /></Entitled>} />
            <Route path="/app/scans/:id" element={<Entitled><ScanResult /></Entitled>} />
            <Route path="/app/library" element={<Entitled><Library /></Entitled>} />

            <Route path="/register" element={<Navigate to="/join" replace />} />
            <Route path="/signup" element={<Navigate to="/join" replace />} />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
            <Route path="/dashboard" element={<Navigate to="/app" replace />} />
            <Route path="/scan/new" element={<Navigate to="/app/scan/new" replace />} />
            <Route path="/scan/:id" element={<Navigate to="/app" replace />} />
            <Route path="/library" element={<Navigate to="/app/library" replace />} />
            <Route path="/payment-success" element={<Navigate to="/app/payment-success" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster theme="dark" position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
