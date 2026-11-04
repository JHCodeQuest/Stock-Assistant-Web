export const API_URL = process.env.REACT_APP_API_URL || 'https://stock-assistant-api-3x6i.onrender.com/api';

// Stored upload paths belong to the API origin, even when the frontend runs on Pages.
export const resolveImageUrl = (imageUrl: string): string =>
  new URL(imageUrl, new URL(API_URL, window.location.origin)).href;
