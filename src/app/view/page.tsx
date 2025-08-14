import { Suspense } from "react";
import ViewPage from "./view-frame";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading content...</div>}>
      <ViewPage />
    </Suspense>
  );
}
