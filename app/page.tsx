import WeddingPage from "./wedding";
import { netlifyRsvpDatabase } from "../lib/netlify-rsvp-database";

export const dynamic = "force-dynamic";
export default function Page() {
  return <WeddingPage rsvpAvailable={Boolean(netlifyRsvpDatabase())} />;
}
