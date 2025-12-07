import { Authenticated, Refine, WelcomePage } from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";
import authProvider from "./authProvider";
import { supabaseClient } from "./utility";
import { NewAccountsList } from "./pages/profiles/list";
import { BookingList } from "./pages/bookings/list";
import { BookingShow } from "./pages/bookings/show";
import { LoginPage } from "./pages/Login";

const AppShell = () => {
  const navigate = useNavigate();
  const [brandLabel, setBrandLabel] = useState("Buzz Portal");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const readRole = () => {
      const role = localStorage.getItem("buzz_portal_role");
      setRole(role);
      const label =
        role === "admin"
          ? "Admin Portal"
          : role === "pilot"
          ? "Pilot Portal"
          : role === "editor"
          ? "Editor Portal"
          : role === "client"
          ? "Client Portal"
          : "Buzz Portal";
      setBrandLabel(label);
    };
    readRole();
    window.addEventListener("storage", readRole);
    return () => window.removeEventListener("storage", readRole);
  }, []);

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <nav className="top-nav">
        <div className="top-nav__left">
          <Link to="/profiles" className="brand">
            {brandLabel}
          </Link>
          {role !== "pilot" && <Link to="/profiles">New Accounts</Link>}
          <Link to="/bookings">Bookings</Link>
        </div>
        <div className="top-nav__right">
          <button className="ghost-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>
      <div className="page-shell">
        <Routes>
          <Route
            index
            element={
              <Navigate
                to={role === "pilot" ? "/bookings" : "/profiles"}
                replace
              />
            }
          />
          <Route
            path="/profiles"
            element={
              role === "pilot" ? (
                <Navigate to="/bookings" replace />
              ) : (
                <NewAccountsList />
              )
            }
          />
          <Route path="/bookings" element={<BookingList />} />
          <Route path="/bookings/:id" element={<BookingShow />} />
          <Route path="*" element={<WelcomePage />} />
        </Routes>
      </div>
    </>
  );
};

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <DevtoolsProvider>
          <Refine
            dataProvider={dataProvider(supabaseClient)}
            liveProvider={liveProvider(supabaseClient)}
            authProvider={authProvider}
            routerProvider={routerProvider}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
              projectId: "7bfsGC-5DoEI4-5uF75J",
            }}
            resources={[
              {
                name: "profiles",
                list: "/profiles",
              },
              {
                name: "bookings",
                list: "/bookings",
                show: "/bookings/:id",
              },
              {
                name: "booking_media_files",
                list: "/bookings/:id",
              },
              {
                name: "booking_editors",
                list: "/bookings/:id",
              },
            ]}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="*"
                element={
                  <Authenticated
                    key="app-auth"
                    fallback={<Navigate to="/login" replace />}
                  >
                    <AppShell />
                  </Authenticated>
                }
              />
            </Routes>
            <RefineKbar />
            <UnsavedChangesNotifier />
            <DocumentTitleHandler />
          </Refine>
          <DevtoolsPanel />
        </DevtoolsProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
