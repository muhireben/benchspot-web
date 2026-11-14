import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.includes("--dry-run");
const sourcePath = argumentsList.find((argument) => argument !== "--dry-run");
const projectUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY;
let bearerToken = anonKey;

if (!sourcePath) {
  console.error("Usage: node supabase/import-benches.mjs <benches.json> [--dry-run]");
  process.exitCode = 1;
} else {
  const parsed = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
  if (!Array.isArray(parsed)) {
    throw new TypeError("The source file must contain a JSON array.");
  }
  const { benches, skippedSamples } = validateSource(parsed);
  if (dryRun) {
    console.log(
      `Dry run: ${benches.length} eligible benches; ${skippedSamples} sample benches excluded. No Supabase calls were made.`,
    );
  } else if (!projectUrl || !anonKey) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_ANON_KEY, or pass --dry-run to validate the source only.",
    );
    process.exitCode = 1;
  } else {
    await importBenches(benches, skippedSamples);
  }
}

function validateSource(parsed) {
  const benches = [];
  let skippedSamples = 0;
  for (const bench of parsed) {
    if (bench?.isSample === true) {
      skippedSamples++;
      continue;
    }
    validateBench(bench);
    const reviews = bench.reviews || [];
    reviews.forEach(validateReview);
    benches.push(bench);
  }
  return { benches, skippedSamples };
}

async function importBenches(parsed, skippedSamples) {
  const { access_token: accessToken, user } = await request("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ data: { source: "legacy-json-import" } }),
  });
  if (!accessToken || !user?.id) {
    throw new Error("Supabase did not create an anonymous import identity.");
  }
  bearerToken = accessToken;

  let imported = 0;
  for (const bench of parsed) {
    const existed = await recordExists("benches", bench.id);
    const reviews = Array.isArray(bench.reviews) ? bench.reviews : [];
    reviews.forEach(validateReview);
    if (!existed) {
      if (reviews.length) {
        await importNewBench(bench, reviews[0], user.id);
      } else {
        await request("/rest/v1/benches", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify(benchRow(bench, user.id)),
        });
      }
      imported++;
    }

    for (const review of existed ? reviews : reviews.slice(1)) {
      if (await recordExists("bench_reviews", review.id)) continue;
      const photoPaths = await uploadPhotos(review, user.id);
      try {
        await request("/rest/v1/bench_reviews?on_conflict=id", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({
            id: review.id,
            bench_id: bench.id,
            author: review.author || "Anonymous",
            rating: review.rating,
            text: review.text || "",
            photo_paths: photoPaths,
            created_at: review.createdAt || new Date().toISOString(),
            created_by: user.id,
          }),
        });
      } catch (error) {
        await removePhotos(photoPaths);
        throw error;
      }
    }
  }
  console.log(
    `Imported ${imported} benches. Skipped ${skippedSamples} sample benches.`,
  );
}

async function importNewBench(bench, firstReview, userId) {
  validateReview(firstReview);
  const photoPaths = await uploadPhotos(firstReview, userId);
  try {
    await request("/rest/v1/rpc/create_bench_with_first_review", {
      method: "POST",
      body: JSON.stringify({
        p_bench: {
          ...benchRow(bench, userId),
          created_by: undefined,
        },
        p_review: {
          id: firstReview.id,
          author: firstReview.author || "Anonymous",
          rating: firstReview.rating,
          text: firstReview.text || "",
          photo_paths: photoPaths,
          created_at: firstReview.createdAt || new Date().toISOString(),
        },
      }),
    });
  } catch (error) {
    await removePhotos(photoPaths);
    throw error;
  }
}

function benchRow(bench, userId) {
  return {
    id: bench.id,
    name: bench.name,
    kind: bench.kind || "Bench",
    note: bench.note || "",
    lat: bench.lat,
    lng: bench.lng,
    created_at: bench.createdAt || new Date().toISOString(),
    created_by: userId,
  };
}

function validateBench(bench) {
  if (!bench || typeof bench !== "object" || Array.isArray(bench)) {
    throw new TypeError("Each bench must be an object.");
  }
  if (typeof bench.id !== "string" || !bench.id) {
    throw new TypeError("Each bench must have an id.");
  }
  if (typeof bench.name !== "string" || !bench.name.trim() || bench.name.length > 60) {
    throw new TypeError(`Bench ${bench.id} must have a name of at most 60 characters.`);
  }
  if (!Number.isFinite(bench.lat) || bench.lat < -90 || bench.lat > 90 ||
      !Number.isFinite(bench.lng) || bench.lng < -180 || bench.lng > 180) {
    throw new TypeError(`Bench ${bench.id} has invalid coordinates.`);
  }
  if (typeof (bench.kind || "Bench") !== "string" ||
      typeof (bench.note || "") !== "string" || (bench.note || "").length > 1000) {
    throw new TypeError(`Bench ${bench.id} has invalid kind or note text.`);
  }
  if (bench.reviews != null && !Array.isArray(bench.reviews)) {
    throw new TypeError(`Bench ${bench.id} reviews must be an array.`);
  }
}

function validateReview(review) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    throw new TypeError("Each review must be an object.");
  }
  if (typeof review.id !== "string" || !review.id) {
    review.id = randomUUID();
  }
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
    throw new TypeError(`Review ${review.id} must have a rating from 1 to 5.`);
  }
  if (typeof (review.author || "Anonymous") !== "string" ||
      (review.author || "Anonymous").length > 80) {
    throw new TypeError(`Review ${review.id} has an invalid author name.`);
  }
  if (typeof (review.text || "") !== "string" || (review.text || "").length > 500) {
    throw new TypeError(`Review ${review.id} text must be at most 500 characters.`);
  }
  if (review.photos != null &&
      (!Array.isArray(review.photos) || review.photos.length > 3)) {
    throw new TypeError(`Review ${review.id} can contain at most 3 photos.`);
  }
}

async function recordExists(table, id) {
  const query = new URLSearchParams({ select: "id", id: `eq.${id}` });
  const rows = await request(`/rest/v1/${table}?${query}`);
  return rows.length > 0;
}

async function uploadPhotos(review, userId) {
  const paths = [];
  try {
    for (let index = 0; index < (review.photos || []).length; index++) {
      const photo = review.photos[index];
      const match = /^data:image\/jpeg;base64,(.+)$/.exec(photo);
      if (!match) {
        throw new TypeError(`Review ${review.id} contains a photo that is not a JPEG data URL.`);
      }
      const bytes = Buffer.from(match[1], "base64");
      if (bytes.length > 5 * 1024 * 1024) {
        throw new RangeError(`A photo in review ${review.id} exceeds 5 MB.`);
      }
      const objectPath = `${userId}/${review.id}/${index}.jpg`;
      await request(`/storage/v1/object/bench-photos/${objectPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          "x-upsert": "true",
        },
        body: bytes,
      });
      paths.push(objectPath);
    }
    return paths;
  } catch (error) {
    await removePhotos(paths);
    throw error;
  }
}

async function removePhotos(paths) {
  if (!paths.length) return;
  try {
    await request("/storage/v1/object/bench-photos", {
      method: "DELETE",
      body: JSON.stringify({ prefixes: paths }),
    });
  } catch (error) {
    console.error("Could not remove unused imported photos.", error);
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${bearerToken || anonKey}`);
  if (options.body && !(options.body instanceof Uint8Array)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${projectUrl}${path}`, {
    ...options,
    headers,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${path} returned HTTP ${response.status}: ${body}`);
  }
  if (!body) return null;
  return JSON.parse(body);
}
