export function isClaimWorthy(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  
  const musicIndicators = ['[music]', '♪', 'lyrics', 'chorus', 'verse', 'guitar', 'beat', 'singer', '[applause]'];
  let musicScore = 0;
  for (const ind of musicIndicators) {
    if (lower.includes(ind)) musicScore++;
  }
  
  const vlogIndicators = ["what's up guys", 'smash that like', 'subscribe', 'unboxing', 'vlog', 'prank', 'skit', 'bloopers', '[laughter]', 'lol', 'lmao'];
  let vlogScore = 0;
  for (const ind of vlogIndicators) {
    if (lower.includes(ind)) vlogScore++;
  }

  if (musicScore >= 2 || (musicScore >= 1 && lower.length < 150)) {
    console.log('[ClaimGate] SKIP - music');
    return false;
  }
  
  if (vlogScore >= 3 || (vlogScore >= 2 && lower.length < 200)) {
    console.log('[ClaimGate] SKIP - vlog');
    return false;
  }
  
  const words = lower.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 8) {
    console.log('[ClaimGate] SKIP - no_factual_claim');
    return false;
  }
  
  console.log('[ClaimGate] PASS');
  return true;
}
