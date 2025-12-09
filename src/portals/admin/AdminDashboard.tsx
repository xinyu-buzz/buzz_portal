import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabaseClient } from "../../utility";
import type { PortalRole } from "../shared/role";

type AdminDashboardProps = {
  role: PortalRole | null;
};

type DashboardCard = {
  key: string;
  title: string;
  description: string;
  to?: string;
  actionLabel?: string;
  comingSoon?: boolean;
};

const dashboardCards: DashboardCard[] = [
  {
    key: "accounts",
    title: "New Accounts",
    description: "Review the latest signups and user profiles.",
    to: "/admin/profiles",
    actionLabel: "Review accounts",
  },
  {
    key: "bookings",
    title: "Bookings",
    description: "Track bookings in progress, pilots assigned, and delivery status.",
    to: "/admin/bookings",
    actionLabel: "Go to bookings",
  },
  {
    key: "admin",
    title: "Admin Center",
    description: "Manage roles, permissions, and org-level settings.",
    to: "/admin/admin-center",
    actionLabel: "Open admin center",
  },
];

export const AdminDashboard: FC<AdminDashboardProps> = ({ role }) => {
  const [displayName, setDisplayName] = useState<string>("there");
  const visibleCards = useMemo(
    () =>
      dashboardCards.filter((card) => {
        if (card.key === "accounts" && role === "editor") return false;
        if (card.key === "admin") {
          return role === "admin" || role === "owner";
        }
        return true;
      }),
    [role]
  );

  useEffect(() => {
    const loadName = async () => {
      try {
        const { data } = await supabaseClient.auth.getUser();
        const email = data?.user?.email?.toLowerCase();
        if (!email) return;
        const { data: emp } = await supabaseClient
          .from("employee_profiles")
          .select("name")
          .eq("email", email)
          .maybeSingle();
        if (emp?.name) {
          setDisplayName(emp.name);
        } else {
          setDisplayName(email.split("@")[0] || "there");
        }
      } catch (err) {
        console.error("Failed to load display name", err);
      }
    };
    loadName();
  }, []);

  return (
    <div className="page-shell">
      <div className="dashboard-hero">
        <h1>Welcome back, {displayName}!</h1>
        <p className="muted-text">Pick where to go next</p>
      </div>

      <div className="card-grid">
        {visibleCards.map((card) => (
          <div
            className={`nav-card${card.comingSoon ? " nav-card--soon" : ""}`}
            key={card.key}
          >
            <div className="nav-card__body">
              <p className="nav-card__eyebrow">Workspace</p>
              <h2>{card.title}</h2>
              <p className="nav-card__desc">{card.description}</p>
            </div>

            {card.to ? (
              <Link className="primary-btn" to={card.to}>
                {card.actionLabel ?? "Open"}
              </Link>
            ) : (
              <button className="ghost-btn" disabled>
                {card.actionLabel ?? "Coming soon"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


