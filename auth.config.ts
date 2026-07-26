import type { NextAuthConfig } from 'next-auth'

export default {
  pages: {
    signIn: '/login',
  },
  providers: [], // filled in in auth.ts
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = request.nextUrl.pathname.startsWith('/dashboard')
      if (isOnDashboard) return isLoggedIn
      return true
    },
  },
} satisfies NextAuthConfig