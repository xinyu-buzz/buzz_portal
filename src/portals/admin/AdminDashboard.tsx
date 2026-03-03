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

type DashboardSection = {
  label: string;
  cards: DashboardCard[];
};

const dashboardSections: DashboardSection[] = [
  {
    label: "Operations",
    cards: [
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
    ],
  },
  {
    label: "Academy",
    cards: [
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
    ],
  },
  {
    label: "Pilots",
    cards: [
      {
        key: "pilot-management",
        title: "Pilot Management",
        description: "Review pilot applications for express promotions, flight reviewer, and ROC-A examiner roles.",
        to: "/admin/pilot-management",
        actionLabel: "Manage pilots",
      },
      {
        key: "pilot-accounts",
        title: "Pilot Accounts",
        description: "View pilots with special roles including Flight Reviewer, ROC-A Examiner, Dual Citizen, FAA, and TC.",
        to: "/admin/pilot-accounts",
        actionLabel: "View pilot accounts",
      },
    ],
  },
  {
    label: "Communications",
    cards: [
      {
        key: "newsletter",
        title: "Newsletter",
        description: "Write and send newsletters to your subscribers.",
        to: "/admin/newsletter",
        actionLabel: "Compose newsletter",
      },
    ],
  },
  {
    label: "System",
    cards: [
      {
        key: "admin",
        title: "Admin Center",
        description: "Manage roles, permissions, and org-level settings.",
        to: "/admin/admin-center",
        actionLabel: "Open admin center",
      },
      {
        key: "app-analytics",
        title: "App Analytics",
        description: "View cockpit component usage statistics, trends, and user engagement data.",
        to: "/admin/app-analytics",
        actionLabel: "View analytics",
      },
    ],
  },
];

export const AdminDashboard: FC<AdminDashboardProps> = ({ role }) => {
  const [displayName, setDisplayName] = useState<string>("there");
  const visibleSections = useMemo(() => {
    const filterCard = (card: DashboardCard): boolean => {
      if (card.key === "accounts" && role === "editor") return false;
      if (
        card.key === "admin" ||
        card.key === "newsletter" ||
        card.key === "academy" ||
        card.key === "academy-manager" ||
        card.key === "app-analytics" ||
        card.key === "pilot-management" ||
        card.key === "pilot-accounts"
      ) {
        return role === "admin" || role === "owner";
      }
      return true;
    };

    return dashboardSections
      .map((section) => ({
        ...section,
        cards: section.cards.filter(filterCard),
      }))
      .filter((section) => section.cards.length > 0);
  }, [role]);

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

      {visibleSections.map((section) => (
        <div key={section.label} className="dashboard-section">
          <h2 className="dashboard-section__header">{section.label}</h2>
          <div className="card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {section.cards.map((card) => (
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
      ))}
    </div>
  );
};





