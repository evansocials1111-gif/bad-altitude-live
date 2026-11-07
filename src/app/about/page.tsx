import { PageHeader } from "@/components/ui/bits";

const FAQ = [
  ["What is this?", "A 24/7 live stream of two AI roommates, Tanner and Jade, on one couch. An AI writes every line as it happens, in response to the chat, so they react to you, to the token and to each other."],
  ["Are they real people?", "No. Tanner and Jade are fictional AI characters, and the stream says so on screen. Their voices are computer generated."],
  ["Do I have to move my tokens?", "No. Tokens stay wherever they are. We read the public chain to see your balance. We can't touch your funds, because we never have your keys."],
  ["Why isn't pasting my address enough?", "Addresses are public, so anyone could paste a whale's. Pasting shows you a balance but gives no priority. To count, you prove control with a free signature, or with a tiny transfer from wallets that can't sign messages, such as many trading platforms."],
  ["How does priority work?", "A score combines your verified holdings (on a log scale), your tier, how long you've waited, and how recently you were answered. Bigger holders generally go first, but nobody waits forever."],
  ["Multiple wallets?", "Verify as many as you like. Balances of verified wallets on one account add together. A wallet can only be verified on one account at a time, so nothing is counted twice."],
  ["Are they telling the truth?", "Absolutely not. They're made up. They quote market figures only from a live feed and say so when it's down, but nothing they say is financial advice, and the token can lose all its value."],
  ["What won't the show do?", "It is vulgar and mean on purpose, and they will roast you. But slurs, sexual content involving minors, real threats, doxxing and real-world harm are blocked for users and characters alike."],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-28 sm:px-8">
      <PageHeader eyebrow="About" title="What fresh hell is this">Two original AI characters, one couch, and a chat that never shuts up.</PageHeader>
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="glass group rounded-2xl p-4 open:border-ember/30">
            <summary className="cursor-pointer list-none font-extrabold">{q}</summary>
            <p className="mt-2 text-sm text-frost">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
