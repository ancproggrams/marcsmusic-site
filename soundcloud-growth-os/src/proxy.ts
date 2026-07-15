import { NextRequest, NextResponse } from "next/server";
import {
  adminAuthFailureResponse,
  authenticateAdminRequest,
  isAdminAuthPublicPath
} from "@/lib/security/adminAuth";

export function proxy(request: NextRequest) {
  if (isAdminAuthPublicPath(request.nextUrl.pathname)) return NextResponse.next();

  const decision = authenticateAdminRequest(request);
  if (!decision.ok) return adminAuthFailureResponse(request, decision.reason);

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Authorization");
  return response;
}

export const config = {
  matcher: "/:path*"
};
