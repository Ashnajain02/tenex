import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = nextUrl.pathname.startsWith("/c");
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register");

      if (isProtected) {
        if (isLoggedIn) return true;
        return false;
      }
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/c", nextUrl));
      }
      return true;
    },
  },
  providers: [],
};
