import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility";

type PortalLink = {
  to: string;
  label: string;
  hidden?: boolean;
};

type NavSection = {
  label: string;
  links: PortalLink[];
};

type PortalLayoutProps = {
  brand: string;
  links: PortalLink[];
  sections?: NavSection[];
  dashboardLink?: PortalLink;
  children: ReactNode;
};

export type { PortalLink, NavSection };

export const PortalLayout = ({
  brand,
  links,
  sections,
  dashboardLink,
  children,
}: PortalLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <nav className="top-nav">
        <div className="top-nav__left">
          <Link
            to={dashboardLink?.to ?? links[0]?.to ?? "/"}
            className="brand"
          >
            {brand}
          </Link>
          {sections ? (
            <>
              {dashboardLink && (
                <Link to={dashboardLink.to}>{dashboardLink.label}</Link>
              )}
              {sections.map((section) => (
                <div key={section.label} className="nav-section">
                  <span className="nav-section__trigger" tabIndex={0}>
                    {section.label}
                  </span>
                  <div className="nav-section__dropdown">
                    {section.links
                      .filter((link) => !link.hidden)
                      .map((link) => (
                        <Link key={link.to} to={link.to}>
                          {link.label}
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            links
              .filter((link) => !link.hidden)
              .map((link) => (
                <Link key={link.to} to={link.to}>
                  {link.label}
                </Link>
              ))
          )}
        </div>
        <div className="top-nav__right">
          <button className="ghost-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>
      <div className="page-shell">{children}</div>
    </>
  );
};





