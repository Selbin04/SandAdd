/**
 * Downscales and center-crops any image to an avatar Data URL (JPEG format)
 * to prevent localStorage quota overflows and ensure fast loading.
 */
export function resizeImageToAvatar(file, maxSize = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    if (!file.type || !file.type.startsWith("image/")) {
      return reject(new Error("Please select an image file"));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          // Center-crop square to prevent distortion
          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          const outSize = Math.min(maxSize, minDim);
          canvas.width = outSize;
          canvas.height = outSize;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve(String(reader.result || ""));
          }

          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            outSize,
            outSize
          );

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        } catch {
          resolve(String(reader.result || ""));
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Saves or removes the user's avatar across all relevant localStorage keys
 * and dispatches events so all open panels/components update immediately.
 */
export function saveUserAvatar(dataUrl) {
  try {
    const clean = typeof dataUrl === "string" ? dataUrl.trim() : "";
    if (clean) {
      localStorage.setItem("sandadd.userAvatar", clean);
    } else {
      localStorage.removeItem("sandadd.userAvatar");
    }

    // Sync to userProfile
    try {
      const rawProfile = localStorage.getItem("sandadd.userProfile");
      const profile = rawProfile ? JSON.parse(rawProfile) : {};
      if (clean) profile.avatar = clean;
      else delete profile.avatar;
      localStorage.setItem("sandadd.userProfile", JSON.stringify(profile));
    } catch {}

    // Sync to author
    try {
      const rawAuthor = localStorage.getItem("sandadd.author");
      const author = rawAuthor ? JSON.parse(rawAuthor) : {};
      if (clean) author.avatar = clean;
      else delete author.avatar;
      localStorage.setItem("sandadd.author", JSON.stringify(author));
    } catch {}

    // Sync to authUser
    try {
      const rawAuth = localStorage.getItem("sandadd.authUser");
      if (rawAuth) {
        const auth = JSON.parse(rawAuth);
        if (clean) auth.avatar = clean;
        else delete auth.avatar;
        localStorage.setItem("sandadd.authUser", JSON.stringify(auth));
      }
    } catch {}

    // Broadcast update to all components
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sandadd:avatar-changed", { detail: clean }));
      window.dispatchEvent(new CustomEvent("sandadd:profile-updated", { detail: { avatar: clean } }));
      window.dispatchEvent(new Event("storage"));
    }
    return true;
  } catch (err) {
    console.error("Failed to save avatar", err);
    return false;
  }
}

