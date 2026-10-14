import { env } from "cloudflare:workers";
import { postRsvp, getRsvp, deleteRsvp } from "../../../lib/rsvp-service";

export const dynamic = "force-dynamic";
export function POST(request:Request) {return postRsvp(request,env.DB);}
export function GET(request:Request) {return getRsvp(request,env.DB);}
export function DELETE(request:Request) {return deleteRsvp(request,env.DB);}
