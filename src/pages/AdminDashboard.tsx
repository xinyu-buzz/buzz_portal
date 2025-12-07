import type { FC } from "react";
import { Link } from "react-router-dom";

type AdminDashboardProps = {
  role: string | null;
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
    description: "Review and approve the latest signups and user profiles.",
    to: "/profiles",
    actionLabel: "Review accounts",
  },
  {
    key: "bookings",
    title: "Bookings",
    description: "Track bookings in progress, pilots assigned, and delivery status.",
    to: "/bookings",
    actionLabel: "Go to bookings",
  },
  {
    key: "admin",
    title: "Admin Center",
    description: "Manage roles, permissions, and org-level settings (coming soon).",
    comingSoon: true,
    actionLabel: "Coming soon",
  },
];

const formatPortalLabel = (role: string | null) => {
  if (role === "admin") return "Admin Portal";
  if (role) return `${role.charAt(0).toUpperCase()}${role.slice(1)} Portal`;
  return "Buzz Portal";
};

export const AdminDashboard: FC<AdminDashboardProps> = ({ role }) => {
  return (
    <div className="page-shell">
      <div className="dashboard-hero">
        <p className="eyebrow">{formatPortalLabel(role)}</p>
        <h1>Pick where to go next</h1>
        <p className="muted-text">
          Quick links into the areas you use most. Cards stay pinned here as
          we add more admin tools.
        </p>
      </div>

      <div className="card-grid">
        {dashboardCards.map((card) => (
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

