import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../shared/PortalLayout";
import { BookingList } from "../shared/bookings/BookingList";
import { BookingShow } from "../shared/bookings/BookingShow";
import { NewAccountsList } from "../admin/NewAccountsList";
import { getPortalLabel } from "../shared/role";

export const ClientPortal = () => {
  const brand = getPortalLabel("client");

  return (
    <PortalLayout
      brand={brand}
      links={[
        { to: "/client/bookings", label: "Bookings" },
        { to: "/client/profiles", label: "New Accounts" },
      ]}
    >
      <Routes>
        <Route index element={<Navigate to="/client/bookings" replace />} />
        <Route
          path="bookings"
          element={<BookingList basePath="/client" role="client" />}
        />
        <Route
          path="bookings/:id"
          element={<BookingShow basePath="/client" role="client" />}
        />
        <Route path="profiles" element={<NewAccountsList />} />
        <Route path="*" element={<Navigate to="/client/bookings" replace />} />
      </Routes>
    </PortalLayout>
  );
};

