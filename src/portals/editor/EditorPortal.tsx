import { Navigate, Route, Routes } from "react-router-dom";
import { PortalLayout } from "../shared/PortalLayout";
import { BookingList } from "../shared/bookings/BookingList";
import { BookingShow } from "../shared/bookings/BookingShow";
import { getPortalLabel } from "../shared/role";

export const EditorPortal = () => {
  const brand = getPortalLabel("editor");

  return (
    <PortalLayout
      brand={brand}
      links={[{ to: "/editor/bookings", label: "Bookings" }]}
    >
      <Routes>
        <Route index element={<Navigate to="/editor/bookings" replace />} />
        <Route
          path="bookings"
          element={<BookingList basePath="/editor" role="editor" />}
        />
        <Route
          path="bookings/:id"
          element={<BookingShow basePath="/editor" role="editor" />}
        />
        <Route path="*" element={<Navigate to="/editor/bookings" replace />} />
      </Routes>
    </PortalLayout>
  );
};

