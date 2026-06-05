export class CaptionExtractor {
  private static lastTranscript = "";

  static reset() {
    this.lastTranscript = "";
  }

  static getTranscript(): string {
    const containers = document.querySelectorAll(".ytp-caption-window-container");
    const activeContainer = Array.from(containers).find(
      (c) => c.getBoundingClientRect().width > 0 && c.getBoundingClientRect().height > 0
    );

    if (containers.length > 1) {
      console.log("[Transcript] Multiple caption containers detected");
    }

    if (activeContainer) {
      console.log("[Transcript] Active caption container found");
    }

    const root = activeContainer || document;
    const captionSegments = root.querySelectorAll(".ytp-caption-segment");

    if (!captionSegments.length) return "";

    const currentText = Array.from(captionSegments)
      .map((segment) => segment.textContent?.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!currentText || currentText === this.lastTranscript) {
      return "";
    }

    let newPart = currentText;

    if (this.lastTranscript) {
      if (this.lastTranscript.includes(currentText)) {
        newPart = "";
      } else {
        let maxOverlap = 0;
        const maxLen = Math.min(this.lastTranscript.length, currentText.length);
        for (let i = 1; i <= maxLen; i++) {
          if (this.lastTranscript.slice(-i) === currentText.slice(0, i)) {
            maxOverlap = i;
          }
        }
        if (maxOverlap > 0) {
          newPart = currentText.slice(maxOverlap).trim();
        }
      }
    }

    this.lastTranscript = currentText;

    if (newPart) {
      console.log("Transcript extracted:", newPart);
      return newPart;
    }

    return "";
  }

  static observeCaptions(
    callback: (text: string) => void
  ): MutationObserver {
    const observer = new MutationObserver(() => {
      const text = this.getTranscript();

      if (text && text.length > 5) {
        callback(text);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }
}