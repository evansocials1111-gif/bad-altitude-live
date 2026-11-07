import { redirect } from "next/navigation";

export default async function LivePage({ searchParams }: { searchParams: Promise<{ ask?: string }> }) {
  const { ask } = await searchParams;
  redirect(ask ? `/?ask=${encodeURIComponent(ask)}` : "/");
}
