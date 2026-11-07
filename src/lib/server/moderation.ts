import { q } from "./db";

export type ModerationResult = { allowed: true; clean: string; injectionSuspected: boolean } | { allowed: false; category: string; message: string };

const MINOR_TERMS = /\b(child(ren)?|kids?|minors?|under[- ]?age(d)?|preteens?|pre-teens?|teen(s|ager|agers)?|schoolgirls?|schoolboys?|toddlers?|little (girl|boy)s?|(1[0-7]|[1-9])[- ]?(yo|y\/o|year[- ]?olds?))\b/i;
const SEXUAL_TERMS = /\b(sex(y|ual|ually)?|nudes?|naked|porn\w*|erotic\w*|horny|fuck(ing)?|molest\w*|grooming|seduc\w*|aroused?|genitals?|blowjobs?|rape\w*)\b/i;
const THREAT = /\b(i('| a)?m? ?(will|gonna|going to|am going to)|i'll)\s+(kill|murder|shoot|stab|bomb|find and hurt)\s+(you|him|her|them|\w+ at)\b/i;
const DOXX = /\b(\d{3}-\d{2}-\d{4}|\d{1,5}\s+\w+(\s\w+)?\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b.*\b(lives?|home|house|address))\b|\b(home address|lives at|doxx?)\b/i;
const CREDENTIAL_REQUEST = /\b(send|give|share|enter|paste|dm)\b.{0,40}\b(seed phrase|private key|recovery phrase|password)\b/i;
const FIN_ADVICE = /\b(guaranteed|risk[- ]free)\b.{0,30}\b(returns?|profits?|gains?|money)\b|\byou (should|must|need to|gotta) (definitely )?(buy|sell|ape|dump|load up)\b|\bprice target\b|\bwill (definitely |absolutely )?(100x|moon|10x|1000x)\b/i;
const INJECTION = /(ignore|disregard|forget|override)\s+(all\s+|any\s+|your\s+|the\s+|previous\s+|prior\s+)*(instructions?|prompts?|rules?)|system prompt|you are now|new instructions|developer mode|jailbreak|<\/?(system|viewer_message|instructions?)>/i;
const BASE58_SECRET = /\b[1-9A-HJ-NP-Za-km-z]{64,90}\b/;

/** Twelve or more short lowercase words in a row is what a recovery phrase looks like. */
export function looksLikeSeedPhrase(text: string) {
  const words = text.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((w) => /^[a-z]{3,8}$/.test(w));
}

function folded(text: string) {
  return text.normalize("NFKC").replace(/[​-‍﻿]/g, "");
}

export function sanitizeUserText(text: string, maxLen: number) {
  return folded(text).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function hardBlock(text: string): { category: string; message: string } | null {
  if (MINOR_TERMS.test(text) && SEXUAL_TERMS.test(text)) {
    return { category: "minor_safety", message: "Blocked. Sexual content involving minors is banned here, no exceptions." };
  }
  if (THREAT.test(text)) return { category: "threat", message: "Blocked. No real threats. Cartoon violence only." };
  if (DOXX.test(text)) return { category: "doxxing", message: "Blocked. No personal information or doxxing." };
  return null;
}

/** Checks anything a user typed. Comedy stays broad; only real-harm categories are refused. */
export function moderateInput(raw: string, maxLen: number): ModerationResult {
  const clean = sanitizeUserText(raw, maxLen);
  if (!clean) return { allowed: false, category: "empty", message: "Say something first." };
  if (looksLikeSeedPhrase(clean) || BASE58_SECRET.test(clean)) {
    return { allowed: false, category: "secret", message: "That looks like a seed phrase or private key, so it was not posted. Never share those with anyone. Move your funds if it was real." };
  }
  const block = hardBlock(clean);
  if (block) return { allowed: false, ...block };
  return { allowed: true, clean, injectionSuspected: INJECTION.test(clean) };
}

/** Checks anything a model generated, before it reaches viewers or the voice provider. */
export function moderateOutput(text: string): { ok: true } | { ok: false; category: string } {
  const block = hardBlock(text);
  if (block) return { ok: false, category: block.category };
  if (CREDENTIAL_REQUEST.test(text)) return { ok: false, category: "credential_request" };
  if (FIN_ADVICE.test(text)) return { ok: false, category: "financial_advice" };
  return { ok: true };
}

export async function recordModeration(userId: string | null, source: string, category: string, excerpt: string) {
  // Secrets are never stored, not even in the moderation log.
  const safe = category === "secret" ? "[withheld]" : excerpt.slice(0, 200);
  await q(`insert into moderation_events (user_id, source, category, excerpt) values ($1,$2,$3,$4)`, [userId, source, category, safe]);
}
