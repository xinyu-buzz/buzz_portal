import { Link } from "react-router-dom";

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
    key: "express-promotions",
    title: "Express Promotions",
    description:
      "Review pilot express promotion applications for Lieutenant and Commander tiers.",
    to: "/admin/express-promotions",
    actionLabel: "Review applications",
  },
  {
    key: "flight-reviewer",
    title: "Flight Reviewer Application",
    description:
      "Review and approve applications from pilots to become flight reviewers.",
    to: "/admin/flight-reviewer-applications",
    actionLabel: "Review applications",
  },
  {
    key: "roc-a-examiner",
    title: "ROC-A Examiner Application",
    description:
      "Review and approve applications from pilots to become ROC-A examiners.",
    to: "/admin/roc-a-examiner-applications",
    actionLabel: "Review applications",
  },
  {
    key: "dual-citizen-pilot",
    title: "Dual Citizen Pilot Application",
    description:
      "Review and approve dual citizen pilot applications.",
    actionLabel: "Coming soon",
    comingSoon: true,
  },
];

export const PilotManagement = () => {
  return (
    <div className="page-shell">
      <h1 style={{ marginBottom: "24px" }}>Pilot Management</h1>

      <div
        className="card-grid"
        style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
      >
        {dashboardCards.map((card) => (
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
