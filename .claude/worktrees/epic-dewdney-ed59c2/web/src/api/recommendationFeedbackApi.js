import { apiFetch } from "./apiFetch";

const FEEDBACK_PATH = process.env.REACT_APP_RECOMMENDATION_FEEDBACK_PATH || "/recommendations/feedback";

export async function submitRecommendationFeedback(payload) {
  if (!payload) return null;

  return apiFetch(FEEDBACK_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
