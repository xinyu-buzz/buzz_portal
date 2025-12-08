import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility";

type PortalLink = {
  to: string;
  label: string;
  hidden?: boolean;
};

type PortalLayoutProps = {
  brand: string;
  links: PortalLink[];
  children: ReactNode;
};

export const PortalLayout = ({ brand, links, children }: PortalLayoutProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <nav className="top-nav">
        <div className="top-nav__left">
          <Link to={links[0]?.to ?? "/"} className="brand">
            {brand}
          </Link>
          {links
            .filter((link) => !link.hidden)
            .map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
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

