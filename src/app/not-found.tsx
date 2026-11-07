import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 pt-40 text-center">
      <h1 className="display text-5xl">Lost in the whiteout</h1>
      <p className="mt-3 text-frost">This page isn&apos;t on the mountain.</p>
      <Link href="/" className="btn btn-ember mt-6 px-6 py-3">Back to town</Link>
    </div>
  );
}
