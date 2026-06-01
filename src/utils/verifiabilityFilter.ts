/**
 * verifiabilityFilter.ts
 *
 * Sentence-level filter that runs AFTER claimExtractor and BEFORE retrieval.
 * Determines whether extracted sentences contain a verifiable factual claim.
 *
 * REJECTS (never reaches retrieval):
 *   "I'm a dietitian"         → first-person identity statement
 *   "Follow me for tips"      → call-to-action
 *   "Watch till the end"      → engagement bait
 *   "This is my experience"   → personal anecdote
 *   "I love mangoes"          → pure opinion / preference
 *
 * ALLOWS (continues to retrieval):
 *   "Protein shakes damage kidneys"
 *   "5G causes cancer"
 *   "Government banned UPI"
 *   "Turmeric reduces inflammation by 30%"
 */

export interface VerifiabilityResult {
  isVerifiable: boolean;
  reason: string;
  /** The best verifiable claim sentence found, or "" if none. */
  bestClaim: string;
}

// ─── Rejection patterns ───────────────────────────────────────────────────────
// A sentence matching ANY of these is discarded.

const REJECTION_PATTERNS: RegExp[] = [
  // First-person identity / credential claims
  /^i(?:'m| am)(?: an?| the)? (?:doctor|dietitian|nutritionist|trainer|chef|expert|professional|coach|therapist|nurse|physician)/i,
  /^(?:as (?:a|an) )?(?:doctor|dietitian|nutritionist|personal trainer|chef|expert|professional|coach|therapist)[,\s]/i,
  // First-person personal experience
  /^i (?:tried|used|ate|drank|took|did|made|saw|felt|experienced|noticed|found)\b/i,
  /\b(?:in my experience|from my experience|based on my experience|this is my experience)\b/i,
  /^(?:this is|here's) (?:my|how i)\b/i,
  // Calls-to-action and engagement bait
  /\b(?:follow (?:me|us)|hit the bell|turn on notifications|watch till the end|don't forget to (?:like|subscribe)|comment below|share this (?:video)?|link in bio|check the description|stay tuned|don't miss this|drop a like|smash that like|subscribe for more)\b/i,
  // Pure first-person opinions with no factual content
  /^(?:i (?:think|believe|feel|love|hate|like|dislike|prefer|enjoy)|in my opinion|personally[,\s]|for me[,\s])/i,
  // Greeting / intro bait
  /^(?:hey|hi|hello|what'?s up)[,!\s]+(?:guys|everyone|you all|friends|fam|people)\b/i,
  // Meta-commentary about the video itself
  /^(?:today|in this (?:video|short)|in today'?s video|welcome back|let'?s (?:talk about|discuss|explore|look at|start))\b/i,
  // Affirmations / reactions with no claim
  /^(?:omg|wow|amazing|incredible|crazy|insane|unbelievable|shocking|mind.?blowing)[!\s.,]/i,
];

// ─── Verifiability patterns ───────────────────────────────────────────────────
// A sentence matching any of these is a candidate claim.

const VERIFIABLE_PATTERNS: RegExp[] = [
  // Causal / associative language (third-person or passive)
  /\b(?:causes?|caused by|linked to|associated with|leads? to|results? in|triggers?|increases? (?:risk|chance|likelihood)|decreases? (?:risk|chance))\b/i,
  // Scientific authority attribution
  /\b(?:research(?:ers?)?|scientists?|doctors?|studies?|evidence|data|experts?) (?:show[s]?|found|say[s]?|suggest[s]?|confirm[s]?|report[s]?|indicate[s]?|prove[s]?)\b/i,
  /\baccording to\b/i,
  /\b(?:published|peer.?reviewed|clinical(?:ly)?|meta.?analysis|systematic review|randomized (?:controlled )?trial)\b/i,
  // Named authority actions (government, agencies, institutions)
  /\b(?:government|parliament|congress|senate|fda|cdc|who|nih|nasa|court|president|prime minister|central bank|rbi|sebi) (?:ban(?:ned)?|approved?|reject(?:ed)?|announced?|confirmed?|stated?|issued?|passed?|signed?|ruled?|mandated?)\b/i,
  // Specific health/medical subject + verb
  /\b(?:protein|turmeric|vitamin\s+[a-z0-9]+|supplement|vaccine|antibiotic|cancer|diabetes|cholesterol|blood pressure|inflammation|immune system|hormone|insulin|cortisol|serotonin|dopamine|obesity|metabolism) (?:can|will|does|may|might|is|are|was|were|has|have|reduces?|prevents?|causes?|damages?|increases?|decreases?)\b/i,
  // Technology/EMF claims
  /\b(?:5g|wifi|emf|radiation|frequency|mhz|ghz|microwave|electromagnetic)\b/i,
  // Numeric statistics (strong verifiability signal)
  /\b\d+(?:\.\d+)?%(?:\s+of\b)?/i,
  /\b(?:\d+(?:\.\d+)?)\s*(?:mg|mcg|iu|kg|g\b|ml|lb|times|x\s+more|fold)\b/i,
  /\b(?:million|billion|thousand)\s+(?:people|cases|deaths|patients|dollars?|tons?)\b/i,
  // Named bans / policies (without specific named entity)
  /\b(?:ban(?:ned)?|outlawed|prohibited|recalled|mandated|approved|certified)\s+\b/i,
  // Finance / economy
  /\b(?:inflation|gdp|recession|interest rate|stock market|federal reserve|unemployment rate)\b/i,
  // Climate / environment
  /\b(?:climate change|global warming|carbon dioxide|co2 levels?|greenhouse gas|sea level|arctic)\b/i,
];

// ─── Scorer ────────────────────────────────────────────────────────────────────

interface ScoredSentence {
  sentence: string;
  score: number;
  rejected: boolean;
  rejectReason: string;
}

function scoreSentence(sentence: string): ScoredSentence {
  // Step 1: check rejection
  for (const pat of REJECTION_PATTERNS) {
    if (pat.test(sentence)) {
      return { sentence, score: 0, rejected: true, rejectReason: pat.toString().slice(0, 60) };
    }
  }

  // Step 2: score verifiability
  let score = 0;
  for (const pat of VERIFIABLE_PATTERNS) {
    if (pat.test(sentence)) score++;
  }

  return { sentence, score, rejected: false, rejectReason: "" };
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Given a list of extracted sentences, returns the best verifiable factual
 * claim (highest verifiability score, not rejected).
 *
 * If all sentences are rejected or score 0, returns isVerifiable=false
 * so the pipeline exits without making any API calls.
 */
export function filterVerifiableClaim(sentences: string[]): VerifiabilityResult {
  if (!sentences || sentences.length === 0) {
    return { isVerifiable: false, reason: "No sentences provided", bestClaim: "" };
  }

  const scored: ScoredSentence[] = sentences.map(scoreSentence);

  // Priority 1: non-rejected with positive verifiability score
  const verifiable = scored
    .filter((s) => !s.rejected && s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (verifiable.length > 0) {
    const best = verifiable[0];
    console.log(
      `[VerifiabilityFilter] Best claim (score=${best.score}): "${best.sentence.slice(0, 80)}"`
    );
    return {
      isVerifiable: true,
      reason: `Claim scored ${best.score} verifiability signal(s)`,
      bestClaim: best.sentence,
    };
  }

  // Priority 2: non-rejected with score=0 (ambiguous, pass through conservatively)
  const nonRejected = scored.filter((s) => !s.rejected);
  if (nonRejected.length > 0) {
    const best = nonRejected[0];
    console.log(
      `[VerifiabilityFilter] Ambiguous claim (score=0, not rejected): "${best.sentence.slice(0, 80)}"`
    );
    return {
      isVerifiable: false,
      reason: "No verifiable factual claim detected",
      bestClaim: "",
    };
  }

  // All sentences rejected
  console.log(
    `[VerifiabilityFilter] All ${sentences.length} sentence(s) rejected. Blocking pipeline.`
  );
  return {
    isVerifiable: false,
    reason: `All ${sentences.length} extracted sentence(s) matched rejection patterns (CTAs, opinions, personal intros)`,
    bestClaim: "",
  };
}
