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
    key: "enrollment",
    title: "Enrollment",
    description: "View and manage course enrollments, track student progress across all courses.",
    to: "/admin/academy-enrollment",
    actionLabel: "View enrollments",
  },
  {
    key: "test-results",
    title: "Test Results",
    description: "Review and manage test results, approve or reject submitted test forms from students.",
    to: "/admin/academy-test-results",
    actionLabel: "Manage test results",
  },
];

export const AcademyManager = () => {
  return (
    <div className="page-shell">
      <h1 style={{ marginBottom: '24px' }}>Academy Manager</h1>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
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