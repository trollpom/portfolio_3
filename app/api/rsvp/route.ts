import { postRsvp, getRsvp, deleteRsvp } from "../../../lib/rsvp-service";
import { netlifyRsvpDatabase } from "../../../lib/netlify-rsvp-database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function POST(request:Request) {return postRsvp(request,netlifyRsvpDatabase());}
export function GET(request:Request) {return getRsvp(request,netlifyRsvpDatabase());}
export function DELETE(request:Request) {return deleteRsvp(request,netlifyRsvpDatabase());}
