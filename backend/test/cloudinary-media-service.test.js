import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCloudinaryMediaService } from "../src/modules/site/application/cloudinary-media.service.js";

const previous = { cloud: process.env.CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "kinetic-demo";
  process.env.CLOUDINARY_API_KEY = "12345";
  process.env.CLOUDINARY_API_SECRET = "secret";
});

afterEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = previous.cloud;
  process.env.CLOUDINARY_API_KEY = previous.key;
  process.env.CLOUDINARY_API_SECRET = previous.secret;
});

describe("Cloudinary site media", () => {
  it("creates a scoped, deterministic short-lived signature without returning the secret", () => {
    const service = createCloudinaryMediaService({ repository: {}, now: () => 1700000000 });
    expect(service.createUploadSignature()).toEqual(expect.objectContaining({
      cloudName: "kinetic-demo", apiKey: "12345", timestamp: 1700000000, folder: "kinetic-sports/site",
      signature: "c899c3477a4a5f5bf8142f8eabb432914086e48d",
    }));
    expect(service.createUploadSignature()).not.toHaveProperty("apiSecret");
  });

  it("signs avatar uploads using the avatar folder rather than the CMS folder", () => {
    const service = createCloudinaryMediaService({ repository: {}, now: () => 1700000000 });
    expect(service.createProfileUploadSignature()).toEqual(expect.objectContaining({
      folder: "kinetic-sports/avatars",
      signature: "6f2852083a52ecaf0485f7edae7f9b44260b8461",
    }));
  });

  it.each(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"])("rejects uploads when %s is absent", (key) => {
    delete process.env[key];
    const service = createCloudinaryMediaService({ repository: {} });
    expect(() => service.createProfileUploadSignature()).toThrow(expect.objectContaining({
      statusCode: 503, code: "CLOUDINARY_NOT_CONFIGURED",
    }));
  });

  it("records only assets served from the configured Cloudinary folder", async () => {
    const repository = { createMediaAsset: vi.fn().mockResolvedValue({ id: "asset-id" }) };
    const service = createCloudinaryMediaService({ repository });
    await expect(service.recordUpload({
      secureUrl: "https://res.cloudinary.com/kinetic-demo/image/upload/v1/kinetic-sports/site/banner.jpg", publicId: "kinetic-sports/site/banner",
      originalName: "banner.jpg", mimeType: "image/jpeg", bytes: 100, width: 1200, height: 800,
    }, "11111111-1111-4111-8111-111111111111")).resolves.toEqual({ id: "asset-id" });
    expect(repository.createMediaAsset).toHaveBeenCalledWith(expect.objectContaining({ storage_key: "kinetic-sports/site/banner", uploaded_by: "11111111-1111-4111-8111-111111111111" }));
    await expect(service.recordUpload({
      secureUrl: "https://res.cloudinary.com/other/image/upload/v1/kinetic-sports/site/banner.jpg", publicId: "kinetic-sports/site/banner",
      originalName: "banner.jpg", mimeType: "image/jpeg", bytes: 100, width: null, height: null,
    }, "11111111-1111-4111-8111-111111111111")).rejects.toMatchObject({ code: "CLOUDINARY_ASSET_INVALID" });
  });
});
