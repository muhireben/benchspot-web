import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const PHOTO_BUCKET = "bench-photos";

export class BenchRepository {
  constructor() {
    this.client = SUPABASE_URL && SUPABASE_ANON_KEY
      ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;
  }

  async _ready() {
    if (!this.client) {
      throw new Error("Configure the Supabase URL and anon key in js/supabase-config.js.");
    }

    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session) {
      this.currentUserId = sessionData.session.user.id;
      return sessionData.session.user;
    }

    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) throw error;
    if (!data.user) throw new Error("Supabase did not create an anonymous user.");
    this.currentUserId = data.user.id;
    return data.user;
  }

  async load() {
    await this._ready();
    const pageSize = 500;
    const rows = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.client
        .from("benches")
        .select("*, bench_reviews(*)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) break;
    }

    return rows.map((bench) => ({
      id: bench.id,
      name: bench.name,
      kind: bench.kind,
      note: bench.note,
      lat: Number(bench.lat),
      lng: Number(bench.lng),
      createdAt: bench.created_at,
      createdBy: bench.created_by,
      reviews: (bench.bench_reviews || []).map((review) => ({
        id: review.id,
        author: review.author,
        rating: review.rating,
        text: review.text,
        createdAt: review.created_at,
        photos: (review.photo_paths || []).map((path) =>
          this.client.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
        ),
      })),
    }));
  }

  async addBench(spot) {
    const user = await this._ready();
    spot.createdBy = user.id;
    const firstReview = spot.reviews[0];
    if (!firstReview) throw new Error("A new bench needs its initial rating.");
    const photoPaths = await this._uploadPhotos(firstReview, user.id);
    try {
      const { error } = await this.client.rpc("create_bench_with_first_review", {
        p_bench: {
          id: spot.id,
          name: spot.name,
          kind: spot.kind,
          note: spot.note,
          lat: spot.lat,
          lng: spot.lng,
          created_at: spot.createdAt,
        },
        p_review: {
          id: firstReview.id,
          author: firstReview.author,
          rating: firstReview.rating,
          text: firstReview.text,
          photo_paths: photoPaths,
          created_at: firstReview.createdAt,
        },
      });
      if (error) throw error;
    } catch (error) {
      await this._removePhotos(photoPaths);
      throw error;
    }
  }

  async addReview(benchId, review) {
    const user = await this._ready();
    const photoPaths = await this._uploadPhotos(review, user.id);
    try {
      const { error } = await this.client.from("bench_reviews").upsert({
        id: review.id,
        bench_id: benchId,
        author: review.author,
        rating: review.rating,
        text: review.text,
        photo_paths: photoPaths,
        created_at: review.createdAt,
        created_by: user.id,
      }, { onConflict: "id" });
      if (error) throw error;
    } catch (error) {
      await this._removePhotos(photoPaths);
      throw error;
    }
  }

  async deleteBench(id) {
    await this._ready();
    const { data, error } = await this.client
      .from("benches")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("You can only remove benches that you added.");
  }

  ownsBench(bench) {
    return Boolean(this.currentUserId && bench.createdBy === this.currentUserId);
  }

  async _uploadPhotos(review, userId) {
    const paths = [];
    try {
      for (let index = 0; index < (review.photos || []).length; index++) {
        const photo = review.photos[index];
        if (!photo.startsWith("data:image/jpeg;base64,")) {
          throw new Error("A review photo is not a resized JPEG image.");
        }
        const response = await fetch(photo);
        if (!response.ok) throw new Error("A selected photo could not be read.");
        const blob = await response.blob();
        const path = `${userId}/${review.id}/${index}.jpg`;
        const { error } = await this.client.storage.from(PHOTO_BUCKET).upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (error) throw error;
        paths.push(path);
      }
      return paths;
    } catch (error) {
      await this._removePhotos(paths);
      throw error;
    }
  }

  async _removePhotos(paths) {
    if (!paths.length) return;
    const { error } = await this.client.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) console.error("Could not remove unused uploaded photos.", error);
  }
}
