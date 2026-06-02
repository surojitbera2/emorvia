import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Welcome from "@/pages/Welcome";
import Register from "@/pages/Register";
import UserDashboard from "@/pages/UserDashboard";
import ProviderProfile from "@/pages/ProviderProfile";
import CallScreen from "@/pages/CallScreen";
import ChatScreen from "@/pages/ChatScreen";
import Wallet from "@/pages/Wallet";
import Recharge from "@/pages/Recharge";
import UserProfile from "@/pages/UserProfile";
import ProviderHome from "@/pages/ProviderHome";
import ProviderEarnings from "@/pages/ProviderEarnings";
import ProviderBlocked from "@/pages/ProviderBlocked";
import ProviderProfileEdit from "@/pages/ProviderProfileEdit";
import ProviderCallScreen from "@/pages/ProviderCallScreen";
import ProviderChatScreen from "@/pages/ProviderChatScreen";
import AdminLogin from "@/pages/AdminLogin";
import AdminLayout from "@/pages/AdminLayout";
import ProviderAuth from "@/pages/ProviderAuth";
import ChatHistory from "@/pages/ChatHistory";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          {/* OTP-only auth — user flow */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Navigate to="/register" replace />} />
          {/* OTP-only auth — listener (provider) flow has dedicated pages */}
          <Route path="/provider/register" element={<ProviderAuth mode="register" />} />
          <Route path="/provider/login" element={<ProviderAuth mode="login" />} />

          {/* User app */}
          <Route path="/app" element={<UserDashboard />} />
          <Route path="/provider/:id" element={<ProviderProfile />} />
          <Route path="/call/:id" element={<CallScreen />} />
          <Route path="/chat/:id" element={<ChatScreen />} />
          <Route path="/chats" element={<ChatHistory />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/recharge" element={<Recharge />} />
          <Route path="/profile" element={<UserProfile />} />

          {/* Provider */}
          <Route path="/provider" element={<ProviderHome />} />
          <Route path="/provider/earnings" element={<ProviderEarnings />} />
          <Route path="/provider/blocked" element={<ProviderBlocked />} />
          <Route path="/provider/profile" element={<ProviderHome />} />
          <Route path="/provider/profile/edit" element={<ProviderProfileEdit />} />
          <Route path="/provider/call/:userId" element={<ProviderCallScreen />} />
          <Route path="/provider/chat/:userId" element={<ProviderChatScreen />} />
          <Route path="/provider/chats" element={<ChatHistory />} />

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
