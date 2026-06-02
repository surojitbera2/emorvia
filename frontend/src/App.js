import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Welcome from "@/pages/Welcome";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import UserDashboard from "@/pages/UserDashboard";
import ProviderProfile from "@/pages/ProviderProfile";
import CallScreen from "@/pages/CallScreen";
import Wallet from "@/pages/Wallet";
import Recharge from "@/pages/Recharge";
import UserProfile from "@/pages/UserProfile";
import ProviderHome from "@/pages/ProviderHome";
import ProviderEarnings from "@/pages/ProviderEarnings";
import ProviderBlocked from "@/pages/ProviderBlocked";
import ProviderProfileEdit from "@/pages/ProviderProfileEdit";
import ProviderCallScreen from "@/pages/ProviderCallScreen";
import AdminLogin from "@/pages/AdminLogin";
import AdminLayout from "@/pages/AdminLayout";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          {/* Password-based auth (OTP removed) */}
          <Route path="/login" element={<Login role="user" />} />
          <Route path="/register" element={<Register />} />

          {/* User app */}
          <Route path="/app" element={<UserDashboard />} />
          <Route path="/provider/:id" element={<ProviderProfile />} />
          <Route path="/call/:id" element={<CallScreen />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/recharge" element={<Recharge />} />
          <Route path="/profile" element={<UserProfile />} />

          {/* Provider — login only. Admin creates new providers. */}
          <Route path="/provider/login" element={<Login role="provider" />} />
          <Route path="/provider" element={<ProviderHome />} />
          <Route path="/provider/earnings" element={<ProviderEarnings />} />
          <Route path="/provider/blocked" element={<ProviderBlocked />} />
          <Route path="/provider/profile" element={<ProviderHome />} />
          <Route path="/provider/profile/edit" element={<ProviderProfileEdit />} />
          <Route path="/provider/call/:userId" element={<ProviderCallScreen />} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/*" element={<AdminLayout />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
