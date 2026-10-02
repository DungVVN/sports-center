import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCloudinaryImage } from "./cloudinary-upload.js";

const maxBytes = 20 * 1024 * 1024;
const signature = { maxBytes, uploadUrl: "https://example.test/upload", apiKey: "test", timestamp: 1, signature: "test", folder: "test" };
afterEach(() => vi.unstubAllGlobals());

describe("image upload size limit", () => {
  it.each(["image/svg+xml", "image/bmp", "image/tiff", "image/heic", "image/heif", "image/x-icon", "image/jxl"])("allows %s image files", async (type) => {
    const file = new File(["image"], "avatar", { type });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: "https://example.test/avatar", public_id: "test/avatar" }) }));
    await expect(uploadCloudinaryImage(file, async () => signature)).resolves.toBe("https://example.test/avatar");
  });

  it("recognizes HEIC by extension when the browser supplies no MIME type", async () => {
    const file = new File(["image"], "avatar.HEIC");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: "https://example.test/avatar", public_id: "test/avatar" }) }));
    await expect(uploadCloudinaryImage(file, async () => signature)).resolves.toBe("https://example.test/avatar");
  });

  it("rejects non-image files before asking for upload credentials", async () => {
    const getSignature = vi.fn();
    await expect(uploadCloudinaryImage(new File(["document"], "document.pdf", { type: "application/pdf" }), getSignature)).rejects.toMatchObject({ code: "IMAGE_TYPE_INVALID" });
    expect(getSignature).not.toHaveBeenCalled();
  });

  it("accepts an image exactly 20 MB", async () => {
    const file = new File([new Uint8Array(maxBytes)], "avatar.jpg", { type: "image/jpeg" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: "https://example.test/avatar.jpg", public_id: "test/avatar" }) }));
    await expect(uploadCloudinaryImage(file, async () => signature)).resolves.toBe("https://example.test/avatar.jpg");
  });

  it("rejects an image over 20 MB before requesting an upload signature", async () => {
    const file = new File([new Uint8Array(maxBytes + 1)], "avatar.jpg", { type: "image/jpeg" });
    const getSignature = vi.fn();
    await expect(uploadCloudinaryImage(file, getSignature)).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE", message: "Ảnh tối đa 20 MB." });
    expect(getSignature).not.toHaveBeenCalled();
  });

  it("respects a lower limit returned by the deployed server", async () => {
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "avatar.jpg", { type: "image/jpeg" });
    await expect(uploadCloudinaryImage(file, async () => ({ ...signature, maxBytes: 10 * 1024 * 1024 }))).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
  });
});
