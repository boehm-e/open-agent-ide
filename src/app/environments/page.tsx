import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EnvironmentsClient from '@/components/environments/EnvironmentsClient';

export default async function EnvironmentsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user's environments
  const environments = await prisma.environment.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <EnvironmentsClient
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      initialEnvironments={environments}
    />
  );
}
