const PROFILE_AVATAR_EVENT = "moneymate:profile-avatar-updated";
const PROFILE_AVATAR_KEY_PREFIX = "moneymate_profile_avatar";

function getProfileAvatarKey(userId: number) {
  return `${PROFILE_AVATAR_KEY_PREFIX}:${userId}`;
}

export function getProfileAvatar(userId?: number | null) {
  if (userId == null) {
    return "";
  }
  try {
    return localStorage.getItem(getProfileAvatarKey(userId)) ?? "";
  } catch {
    return "";
  }
}

export function saveProfileAvatar(userId: number, dataUrl: string) {
  try {
    localStorage.setItem(getProfileAvatarKey(userId), dataUrl);
  } catch {
    // Storage can fail (quota exceeded, disabled, private mode); still broadcast update.
  }
  window.dispatchEvent(
    new CustomEvent(PROFILE_AVATAR_EVENT, {
      detail: { userId, dataUrl },
    }),
  );
}

export function subscribeToProfileAvatar(
  listener: (userId: number, dataUrl: string) => void,
) {
  const handleAvatarUpdate = (event: Event) => {
    const detail = (event as CustomEvent<{ userId: number; dataUrl: string }>).detail;
    if (detail) {
      listener(detail.userId, detail.dataUrl);
    }
  };

  window.addEventListener(PROFILE_AVATAR_EVENT, handleAvatarUpdate);
  return () => window.removeEventListener(PROFILE_AVATAR_EVENT, handleAvatarUpdate);
}
