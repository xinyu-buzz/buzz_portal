import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../shared/PortalLayout";
import { BookingList } from "../shared/bookings/BookingList";
import { BookingShow } from "../shared/bookings/BookingShow";
import { getPortalLabel } from "../shared/role";

export const ClientPortal = () => {
  const brand = getPortalLabel("client");

  return (
    <PortalLayout
      brand={brand}
      links={[
        { to: "/client/bookings", label: "Bookings" },
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
        <Route path="*" element={<Navigate to="/client/bookings" replace />} />
      </Routes>
    </PortalLayout>
  );
};





