export class PhotoTools {
  static setupPicker(fileInput, previewList, helpText, defaultHelp) {
    let previewUrls = [];
    const clear = () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls = [];
      previewList.replaceChildren();
      helpText.textContent = defaultHelp;
    };
    fileInput.addEventListener("change", () => {
      clear();
      const files = Array.from(fileInput.files || []).slice(0, 3);
      if (fileInput.files.length > 3) {
        helpText.textContent = "Only the first 3 photos will be added.";
      }
      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        previewUrls.push(url);
        const image = document.createElement("img");
        image.src = url;
        image.alt = "Selected photo preview";
        previewList.appendChild(image);
      });
    });
    return clear;
  }

  static resize(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("One of the selected files is not an image."));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error("Each photo must be smaller than 10 MB."));
        return;
      }
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("A selected photo could not be processed."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("A selected photo could not be read."));
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.78);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("A selected photo could not be opened. Try a JPG or PNG image."));
      };
      image.src = objectUrl;
    });
  }
}
