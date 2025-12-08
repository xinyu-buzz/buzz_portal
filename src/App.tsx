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
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminCenter } from "./pages/AdminCenter";

const AppShell = () => {
  const navigate = useNavigate();
  const [brandLabel, setBrandLabel] = useState("Buzz Portal");
  const [role, setRole] = useState<string | null>(
    () => localStorage.getItem("buzz_portal_role") || null
  );

  useEffect(() => {
    const readRole = async () => {
      const stored = localStorage.getItem("buzz_portal_role");
      let resolved = stored;
      try {
        const { data } = await supabaseClient.auth.getUser();
        const email = data?.user?.email?.toLowerCase();
        if (email) {
          const { data: emp } = await supabaseClient
            .from("employee_profiles")
            .select("role")
            .eq("email", email)
            .maybeSingle();
          if (emp?.role) {
            resolved = emp.role;
            localStorage.setItem("buzz_portal_role", emp.role);
          }
        }
      } catch (err) {
        console.error("Failed to resolve role", err);
      }

      setRole(resolved);
      const label =
        resolved === "owner" || resolved === "admin"
          ? "Admin Portal"
          : resolved === "pilot"
          ? "Pilot Portal"
          : resolved === "editor"
          ? "Editor Portal"
          : resolved === "client"
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
          <Link to="/welcome" className="brand">
            {brandLabel}
          </Link>
          {role !== "pilot" && role !== "editor" && (
            <Link to="/profiles">New Accounts</Link>
          )}
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
              role === "pilot" ? (
                <Navigate to="/bookings" replace />
              ) : (
                <Navigate to="/welcome" replace />
              )
            }
          />
          <Route path="/welcome" element={<AdminDashboard role={role} />} />
          <Route
            path="/profiles"
            element={
              role === "pilot" || role === "editor" ? (
                <Navigate to="/bookings" replace />
              ) : (
                <NewAccountsList />
              )
            }
          />
          <Route path="/bookings" element={<BookingList />} />
          <Route path="/bookings/:id" element={<BookingShow />} />
          <Route
            path="/admin-center"
            element={
              role === "admin" || role === "owner" ? (
                <AdminCenter />
              ) : (
                <Navigate to="/bookings" replace />
              )
            }
          />
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
              title: {
                default: "Buzz Portal",
                template: "%s | Buzz Portal",
              },
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
                    key="authenticated"
                    fallback={<Navigate to="/login" replace />}
                  >
                    <AppShell />
                  </Authenticated>
                }
              />
            </Routes>
            <RefineKbar />
            <UnsavedChangesNotifier />
            <DocumentTitleHandler
              handler={({ autoGeneratedTitle }) =>
                autoGeneratedTitle.replace(/Refine/g, "Buzz Portal")
              }
            />
          </Refine>
          <DevtoolsPanel />
        </DevtoolsProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;
