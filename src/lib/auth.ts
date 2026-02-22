import NextAuth from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        
        // Fetch GitHub token from account
        const account = await prisma.account.findFirst({
          where: {
            userId: user.id,
            provider: 'github',
          },
          select: { 
            access_token: true, 
            refresh_token: true,
            expires_at: true,
            providerAccountId: true,
          },
        });
        
        if (account) {
          // Check if token is expired and needs refresh
          const now = Math.floor(Date.now() / 1000);
          const isExpired = account.expires_at && account.expires_at < now;
          
          if (isExpired && account.refresh_token) {
            try {
              // Refresh the token
              const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                },
                body: JSON.stringify({
                  client_id: process.env.GITHUB_ID,
                  client_secret: process.env.GITHUB_SECRET,
                  refresh_token: account.refresh_token,
                  grant_type: 'refresh_token',
                }),
              });
              
              const tokens = await response.json();
              
              if (tokens.access_token) {
                // Update the account with new tokens
                await prisma.account.update({
                  where: {
                    provider_providerAccountId: {
                      provider: 'github',
                      providerAccountId: account.providerAccountId,
                    },
                  },
                  data: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token || account.refresh_token,
                    expires_at: tokens.expires_in 
                      ? Math.floor(Date.now() / 1000) + tokens.expires_in 
                      : null,
                  },
                });
                
                session.user.githubToken = tokens.access_token;
              } else {
                // Token refresh failed, clear the token
                console.error('GitHub token refresh failed:', tokens);
                session.user.githubToken = null;
              }
            } catch (error) {
              console.error('Error refreshing GitHub token:', error);
              session.user.githubToken = null;
            }
          } else {
            // Token is still valid
            session.user.githubToken = account.access_token;
          }
          
          session.user.githubId = account.providerAccountId;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'database',
  },
});

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      githubToken?: string | null;
      githubId?: string | null;
    };
  }
}
