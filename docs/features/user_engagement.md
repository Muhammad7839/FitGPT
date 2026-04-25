# User Engagement & Feedback

## Overview
FitGPT improves recommendation accuracy over time by collecting explicit user feedback on outfit suggestions. Users can like, dislike, or reject outfit recommendations, and the system uses this data to adjust how future outfits are scored and selected. This creates a progressively more personalized experience the more a user interacts with the app.

---

## Recommendation Feedback

### Description
Users can provide quick feedback on outfit recommendations through like and dislike actions. Feedback is recorded immediately and used to influence future recommendation scoring.

### System Behavior
When a user likes an outfit recommendation:
- The feedback is recorded against that outfit's item combination
- The UI updates immediately to confirm the interaction

When a user dislikes or rejects an outfit recommendation:
- The feedback is recorded against that outfit's item combination
- The UI updates immediately to confirm the interaction
- The rejected outfit is flagged for avoidance in future recommendations (see [Rejected Outfit Avoidance](#rejected-outfit-avoidance))

Feedback is always acknowledged with an immediate UI response — no action completes silently.

---

## Rejected Outfit Avoidance

### Description
When a user rejects an outfit, the system records it and avoids recommending the same or similar combinations in future sessions. This ensures users do not repeatedly see outfit suggestions they have already dismissed.

### System Behavior
When a user rejects an outfit:
- The outfit's item combination is stored as a rejection record
- The UI updates immediately to remove or replace the rejected outfit

When new recommendations are generated:
- Exact matches to rejected outfits are excluded from results
- Near matches (outfits that share most of the same items as a rejected combination) are deprioritized through a scoring penalty

Rejection avoidance applies indefinitely unless the user clears their feedback history.

---

## Feedback-Driven Weight Adjustment

### Description
The recommendation engine dynamically adjusts how it weights scoring factors based on accumulated user feedback. Liked outfits reinforce signals that are working well; disliked or rejected outfits reduce the influence of signals that produced poor results.

### System Behavior
When feedback is processed:
- Liked outfits reinforce the scoring signals that contributed to that outfit's selection (e.g., a particular color pairing, style match, or occasion alignment)
- Disliked or rejected outfits reduce the weight of scoring signals that dominated that outfit's score

When conflicting or limited feedback exists:
- The system balances signals conservatively to avoid overfitting to a small number of interactions
- Weight adjustments are gradual — a single dislike does not dramatically alter results

### Recommendation Integration
Updated weights are applied when generating new recommendations. As feedback accumulates, the scoring system becomes increasingly aligned with the user's demonstrated preferences.

---

## Continuous Personalization

### Description
As users continue interacting with the app — liking, disliking, wearing, and rejecting outfits — the recommendation engine builds a clearer picture of their preferences. Over time, recommendations become more relevant and accurate without requiring users to manually update their settings.

### System Behavior
When a user has accumulated interaction data (likes, dislikes, outfit history, rejections):
- Future recommendations reflect the learned preferences derived from that data
- The system prioritizes combinations that align with patterns in the user's positive interactions
- The system avoids patterns associated with negative feedback

When a user is new or has limited interaction data:
- The system falls back to preference settings and default scoring logic
- Personalization improves incrementally as more interactions are recorded

Each interaction contributes to personalization — the system does not require a minimum number of interactions before improvements begin to take effect.

---

## Feedback UX

### Description
Feedback prompts are designed to be subtle and non-intrusive. Providing feedback is always optional — users are never required to interact with feedback controls to continue using the app. The experience remains smooth whether a user engages with feedback or ignores it entirely.

### System Behavior
When feedback options are shown:
- Prompts are displayed in a subtle, unobtrusive way that does not interrupt the user's flow
- Feedback interaction is optional — no action is required to proceed
- If the user ignores a prompt, the app continues normally with no forced interaction or blocking behavior

When a user provides feedback:
- The system records it immediately
- The interaction completes without disrupting the current experience or navigation

Feedback controls are always available but never mandatory. The system does not nag, repeat prompts excessively, or prevent access to any feature if feedback is not given.

---

## Recommendation Confidence Score

### Description
Each outfit recommendation is displayed alongside a confidence score that indicates how well the suggestion matches the user's preferences and context. This gives users a clear signal of how relevant the recommendation is and helps build trust in the system.

### System Behavior
When a recommendation is displayed:
- A confidence score is shown alongside the outfit
- The score is calculated based on personalization factors including feedback history, preference alignment, color coordination, and contextual fit

When the confidence score is presented:
- It is shown in a clear, simple format that is easy to interpret at a glance (e.g., a percentage or visual indicator)
- The score reflects the cumulative influence of the scoring factors evaluated for that specific outfit

As user feedback and interaction data accumulate:
- Confidence scores become more accurate over time, reflecting a better-tuned model of the user's preferences
