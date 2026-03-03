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

const dashboardCardsWithNewsletter: DashboardCard[] = [
  ...dashboardCards,
  {
    key: "academy",
    title: "Academy Courses",
    description: "Manage the courses on buzz academy, titles, descriptions, prerequisites, and more.",
    to: "/admin/academy-courses",
    actionLabel: "Manage courses",
  },
  {
    key: "academy-manager",
    title: "Academy Manager",
    description: "Manage course enrollments and test results, track student progress and approve submissions.",
    to: "/admin/academy-manager",
    actionLabel: "Open academy manager",
  },
  {
    key: "newsletter",
    title: "Newsletter",
    description: "Write and send newsletters to your subscribers.",
    to: "/admin/newsletter",
    actionLabel: "Compose newsletter",
  },
  {
    key: "app-analytics",
    title: "App Analytics",
    description: "View cockpit component usage statistics, trends, and user engagement data.",
    to: "/admin/app-analytics",
    actionLabel: "View analytics",
  },
  {
    key: "pilot-management",
    title: "Pilot Management",
    description: "Review pilot applications for express promotions, flight reviewer, and ROC-A examiner roles.",
    to: "/admin/pilot-management",
    actionLabel: "Manage pilots",
  },
];

export const AdminDashboard: FC<AdminDashboardProps> = ({ role }) => {
  const [displayName, setDisplayName] = useState<string>("there");
  const visibleCards = useMemo(
    () =>
      dashboardCardsWithNewsletter.filter((card) => {
        if (card.key === "accounts" && role === "editor") return false;
        if (card.key === "admin" || card.key === "newsletter" || card.key === "academy" || card.key === "academy-manager" || card.key === "app-analytics" || card.key === "pilot-management") {
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
      <h1 style={{ marginBottom: '24px' }}>Welcome back, {displayName}!</h1>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {visibleCards.map((card) => (
          <div
            className={`nav-card${card.comingSoon ? " nav-card--soon" : ""}`}
            key={card.key}
          >
            <div className="nav-card__body">
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





