import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../shared/PortalLayout";
import { BookingList } from "../shared/bookings/BookingList";
import { BookingShow } from "../shared/bookings/BookingShow";
import { getPortalLabel } from "../shared/role";

export const PilotPortal = () => {
  const brand = getPortalLabel("pilot");

  return (
    <PortalLayout
      brand={brand}
      links={[{ to: "/pilot/bookings", label: "Bookings" }]}
    >
      <Routes>
        <Route index element={<Navigate to="/pilot/bookings" replace />} />
        <Route path="bookings" element={<BookingList basePath="/pilot" role="pilot" />} />
        <Route
          path="bookings/:id"
          element={<BookingShow basePath="/pilot" role="pilot" />}
        />
        <Route path="*" element={<Navigate to="/pilot/bookings" replace />} />
      </Routes>
    </PortalLayout>
  );
};




